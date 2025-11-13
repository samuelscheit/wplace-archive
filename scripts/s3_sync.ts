import axios from "axios";
import { Octokit } from "octokit";
import * as tar from "tar";
import * as fsp from "fs/promises";
import * as path from "path";
import PQueue from "p-queue";
// import { s3 } from "./s3_client";
import { parentPort, Worker, isMainThread, workerData } from "worker_threads";
import { cpus, tmpdir } from "os";
import { awsS3 } from "./s3_client.ts";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { setGlobalDispatcher, Agent } from "undici";
import { fileURLToPath } from "url";
import React, { useState, useEffect } from "react";
import { render, Text } from "ink";
import { state } from "./s3_ui.tsx";
import "./s3_ui.tsx";
import { observable } from "mobx";
import { deleteTilesPrefix, uploadToS3 } from "./s3_util.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

setGlobalDispatcher(
	new Agent({
		connections: null,
		// allowH2: true,
		pipelining: 1,
		keepAliveTimeout: 1000 * 60,
		maxConcurrentStreams: 1000,
		maxRequestsPerClient: 1000,
	}),
);

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
});

const owner = "murolem";
const repo = "wplace-archives";

const BASE_TMP_DIR = path.join(tmpdir(), "wplace", "tiles");

const ensureDir = async (dir: string) => {
	await fsp.mkdir(dir, { recursive: true });
};

async function streamConcatenateAsset(asset: any, releaseName: string, tries = 0) {
	try {
		const s = state.downloadReleases[releaseName]!;

		const response = await axios({
			url: asset.browser_download_url,
			method: "GET",
			responseType: "stream",
			onDownloadProgress(progressEvent) {
				s.downloadBytes = progressEvent.loaded;
				s.totalBytes = asset.size || 0;
			},
		});

		return response.data as ReadableStream;
	} catch (error) {
		if (tries >= 3) {
			console.error(`Failed to download asset ${asset.name} after ${tries} tries:`, error);
			throw error;
		}

		return streamConcatenateAsset(asset, releaseName, tries + 1);
	}
}

const queue = new PQueue({ concurrency: 1000 * 2 });

async function streamConcatenateAssets(assets: any[], keys = new Set<string>(), releaseName: string) {
	const parseStream = new tar.Parser({});

	const s = state.downloadReleases[releaseName]!;

	parseStream.on("entry", (entry) =>
		queue.add(async () => {
			try {
				// console.log(`Processing entry: ${entry.path} (${entry.type})`);
				if (entry.type !== "File") {
					entry.resume();
					return;
				}
				s.currentFile = entry.path;

				const originalPath: string = entry.path;
				const fileName = originalPath.split("/").slice(1).join("/"); // drop top-level folder to match previous behavior
				const s3Key = `tiles/${releaseName}/${fileName}`;

				if (keys.has(s3Key)) {
					s.skippingCurrentFile = true;
					entry.resume();
					return;
				}

				s.skippingCurrentFile = false;

				const content = await new Promise<Buffer>((resolve, reject) => {
					const chunks: Buffer[] = [];
					entry.on("data", (chunk: Buffer) => {
						chunks.push(chunk);
					});
					entry.on("end", () => {
						resolve(Buffer.concat(chunks));
					});
					entry.on("error", (err: any) => {
						reject(err);
					});
				});

				s.extracted++;

				await uploadReleaseToS3({
					releaseName,
					fileName,
					content,
				});
			} catch (error) {
				console.error("Error processing entry:", error);
			}
		}),
	);

	const QUEUE = Object.getOwnPropertySymbols(parseStream).find((s) => s.description === "queue")!;
	const BUFFER = Object.getOwnPropertySymbols(parseStream).find((s) => s.description === "buffer")!;

	s.fetchingDownload = true;

	for (const asset of assets) {
		const stream = await streamConcatenateAsset(asset, releaseName);

		for await (const chunk of stream) {
			s.queueSize = queue.size;
			s.queueRunning = queue.pending;
			s.queueTar = (parseStream as any)[QUEUE].pending;

			// @ts-ignore
			if (parseStream[QUEUE]?.length > 200) {
				await new Promise((resolve) => parseStream.once("drain", resolve));
			}
			await queue.onSizeLessThan(1); // maximum backpressure

			parseStream.write(chunk);
		}

		s.downloaded++;
	}

	s.fetchingDownload = false;

	await queue.onIdle();

	parseStream.end();
}

async function uploadReleaseToS3(opts: { releaseName: string; fileName: string; content: Buffer; tries?: number }) {
	const s = state.downloadReleases[opts.releaseName]!;

	const key = `tiles/${opts.releaseName}/${opts.fileName}`;

	await uploadToS3({
		key: key,
		content: opts.content,
		tries: opts.tries,
	});

	s.uploaded++;
}

async function downloadRelease(release: any) {
	// Discover existing keys in S3 so we can skip
	const keys = new Set<string>();
	let continuationToken: string | undefined;

	let pages = 1;
	const s = (state.downloadReleases[release.name] ||= observable({
		name: release.name,
		start: Date.now(),
		assets: 0,
		pages,
		tiles: 0,
		extracted: 0,
		uploaded: 0,
		downloaded: 0,
	}));

	while (true) {
		s.fetchingList = true;
		const page = await awsS3.send(
			new ListObjectsV2Command({
				Bucket: process.env.S3_BUCKET_NAME,
				Prefix: `tiles/${release.name}/`,
				MaxKeys: 1000,
				ContinuationToken: continuationToken,
			}),
		);
		s.assets! += page.KeyCount || 0;
		s.pages = pages++;

		for (const obj of page.Contents ?? []) {
			if (obj.Key) keys.add(obj.Key);
		}

		const isTruncated = page.IsTruncated;
		const next = page.NextContinuationToken;
		if (!isTruncated || !next) break;
		continuationToken = next;
	}

	s.pages = 0;
	s.assets = 0;

	// Fetch the list of assets for this release
	const assetsResp = await octokit.rest.repos.listReleaseAssets({
		owner,
		repo,
		per_page: 100,
		page: 1,
		release_id: release.id,
	});

	s.fetchingList = false;
	s.assets = assetsResp.data.length;

	const assetsSorted = assetsResp.data.slice().sort((a, b) => a.name.localeCompare(b.name));

	const { name } = release;
	const baseDir = path.join(BASE_TMP_DIR, name);
	await ensureDir(baseDir);

	// Create a tar parser and stream entries to disk one-by-one

	await streamConcatenateAssets(assetsSorted, keys, release.name);

	s.finished = true;
}

async function main() {
	let page = 0;
	let releases = 0;
	let toSync = [];
	let toDelete = [];

	state.listReleases = { page, releases, finished: false, toDelete: 0, toSync: 0 };
	const listReleases = state.listReleases as Required<typeof state.listReleases>;

	release_loop: while (true) {
		const { data } = await octokit.rest.repos.listReleases({
			owner,
			repo,
			per_page: 100,
			page,
		});

		listReleases.page = page++;
		listReleases.releases += data.length;

		for (const release of data) {
			if (!release.published_at) continue;
			const publishedAt = new Date(release.published_at);
			const now = new Date();
			const ageDays = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);

			if (ageDays > 7) {
				toDelete.push(release);
				// if (!toFetch.length) {
				// 	toFetch.push(data.at(-1)!);
				// }

				// break release_loop;
			} else {
				toSync.push(release);
			}
		}

		listReleases.toDelete = toDelete.length;
		listReleases.toSync = toSync.length;

		if (data.length < 100) {
			break;
		}
	}

	listReleases.finished = true;

	const deleteQueue = new PQueue({ concurrency: 100 });

	await deleteQueue.addAll(
		toDelete.map((release) => async () => {
			await deleteTilesPrefix(`tiles/${release.name}/`);
		}),
	);

	const workers = [];

	// const cpuCount = 1; // cpus().length;
	const cpuCount = cpus().length;

	const releasesPerWorker = Math.ceil(toSync.length / cpuCount);

	for (let i = 0; i < cpuCount; i++) {
		const start = i * releasesPerWorker;
		const end = start + releasesPerWorker;
		const releasesForThisWorker = toSync.slice(start, end);

		if (releasesForThisWorker.length === 0) continue;

		if (cpuCount === 1 || 1 == 1) {
			for (const release of releasesForThisWorker) {
				await downloadRelease(release);
			}

			process.exit();
		}

		const worker = new Worker(__filename, {
			workerData: {
				releases: releasesForThisWorker,
			},
		});

		workers.push(
			new Promise<void>((resolve, reject) => {
				worker.on("message", (msg) => {
					console.log("Worker message:", msg);
				});
				worker.on("error", (err) => {
					reject(err);
				});
				worker.on("exit", (code) => {
					if (code !== 0) {
						reject(new Error(`Worker stopped with exit code ${code}`));
					} else {
						resolve();
					}
				});
			}),
		);
	}
}
// downloadArchive();

async function doWork(data: any) {
	const releases: any[] = data.releases;
	for (const release of releases) {
		await downloadRelease(release);
	}
	parentPort?.postMessage("Worker done");
}

if (isMainThread) {
	main();
} else {
	(async () => {
		doWork(workerData.releases);
	})();
}
