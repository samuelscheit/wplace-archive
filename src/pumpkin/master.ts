import { cpus } from "os";
import { Worker } from "worker_threads";
import { getPumpkinEventNumber, type TileMatch } from "./fetch.ts";
import type { WorkerConfig } from "./worker.ts";
import { MAX_OFFSET } from "./freebind.ts";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { tlPxToGps } from "./mercator.ts";
import { existsSync, readFileSync, writeFileSync } from "fs";

import sharp, { type OutputInfo } from "sharp";
import { PumpkinEntry } from "../ui/PumpkinsModal.tsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pumpkins = {} as any;
let pumpkinJsonPath = join(__dirname, "pumpkin.json");

try {
	let volumePath = "/var/lib/docker/volumes/cc0ccwsg4csggwwwg48ookc0_tiles/_data/pumpkin.json";
	if (existsSync(dirname(volumePath))) {
		pumpkinJsonPath = volumePath;
	}
} catch (error) {}

try {
	pumpkins = JSON.parse(readFileSync(pumpkinJsonPath, "utf-8"));
} catch (error) {}

const MAX_X = 2048;
const MAX_Y = 2048;

const defaultWorkerCount = Math.min(cpus().length, 8);
const workerCount = Number.parseInt(process.env.WPLACE_WORKERS ?? "", 10) || defaultWorkerCount;
const workerConcurrency = Number.parseInt(process.env.WPLACE_WORKER_CONCURRENCY ?? "", 10) || 160;

type WorkerMessage =
	| { type: "match"; data: TileMatch }
	| { type: "no_match" }
	| {
			type: "error";
			data: { tileX?: number; tileY?: number; message: string };
	  }
	| {
			type: "done";
			data: { startY: number; endY: number; maxX: number };
	  };

let tilesCounter = 0;

async function spawnWorker(startY: number, endY: number, ipStartOffset: bigint, onMatch: (match: TileMatch) => void) {
	return new Promise<void>((resolve, reject) => {
		const worker = new Worker(join(__dirname, "worker.ts"), {
			workerData: {
				startY,
				endY,
				maxX: MAX_X,
				concurrency: workerConcurrency,
				ipStartOffset: ipStartOffset.toString(),
			} as WorkerConfig,
			execArgv: process.execArgv,
		});

		worker.on("message", (message: WorkerMessage) => {
			if (!message) {
				return;
			}

			tilesCounter += 1;

			switch (message.type) {
				case "no_match": {
					break;
				}
				case "match": {
					onMatch(message.data);
					break;
				}
				case "error": {
					if (message.data.tileX !== undefined && message.data.tileY !== undefined) {
						console.warn(`Worker error at tile (${message.data.tileX}, ${message.data.tileY}): ${message.data.message}`);
					} else {
						console.warn(`Worker error: ${message.data.message}`);
					}
					break;
				}
				case "done": {
					const processedRows = message.data.endY - message.data.startY;
					console.log(`Worker completed rows ${message.data.startY}-${message.data.endY - 1} (${processedRows} rows).`);
					break;
				}
			}
		});

		worker.once("error", reject);
		worker.once("exit", (code) => {
			console.log(`Worker exited with code ${code}`);
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
				return;
			}

			resolve();
		});
	});
}

const matches: TileMatch[] = [];

async function handleMatch(match: TileMatch) {
	matches.push(match);

	const { lat, lng, number } = await getPumpkinEventNumber(match.tileX, match.tileY, match.offsetX, match.offsetY);

	console.log(
		`\n🎃 Pumpkin ${number} at lat: ${lat}, lng: ${lng} (tile: ${match.tileX}, ${match.tileY}, offset: ${match.offsetX}, ${match.offsetY})\nhttps://wplace.live/?lat=${lat}&lng=${lng}&zoom=14\n`,
	);

	if (number !== undefined) {
		pumpkins[number] = {
			lat,
			lng,
			tileX: match.tileX,
			tileY: match.tileY,
			offsetX: match.offsetX,
			offsetY: match.offsetY,
			foundAt: new Date().toISOString(),
		};
	} else {
		Object.entries(pumpkins).forEach(([key, value]) => {
			const entry = value as PumpkinEntry;

			if (
				entry.tileX === match.tileX &&
				entry.tileY === match.tileY &&
				entry.offsetX === match.offsetX &&
				entry.offsetY === match.offsetY
			) {
				// pumpkin doesn't have a event number anymore => find old pumpkin at same location and delete it
				delete pumpkins[key];
			}
		});
	}

	writeFileSync(pumpkinJsonPath, JSON.stringify(pumpkins, null, 2));
}

async function main() {
	const rowsPerWorker = Math.ceil(MAX_Y / workerCount);
	const workerPromises: Promise<void>[] = [];
	const ipOffsetsPerWorker = BigInt(MAX_OFFSET) / BigInt(workerCount);
	let currentIPOffset = 1n;

	console.log({ workerCount, rowsPerWorker, ipOffsetsPerWorker });

	setInterval(() => {
		const tilesPerSecond = (tilesCounter / 5).toFixed(1);
		process.stdout.write(`\rProcessed tiles: ${tilesCounter} (${tilesPerSecond} tiles/sec)   `);
		tilesCounter = 0;
	}, 5000);

	setInterval(() => {
		// check every minute if pumpkins have been removed
		Object.entries(pumpkins).forEach(([key, value]) => {
			handleMatch(value as PumpkinEntry);
		});
	}, 60000);

	for (let index = 0; index < workerCount; index += 1) {
		const startY = index * rowsPerWorker;
		const endY = Math.min(startY + rowsPerWorker, MAX_Y);

		console.log(`Spawning worker ${index + 1}/${workerCount} for rows ${startY}-${endY - 1}`);

		if (startY >= endY) {
			break;
		}

		workerPromises.push(spawnWorker(startY, endY, currentIPOffset, handleMatch));

		currentIPOffset += ipOffsetsPerWorker;
	}

	await Promise.all(workerPromises);

	if (matches.length === 0) {
		console.log("No pumpkins detected across processed tiles.");
	} else {
		console.log(`Total pumpkins detected: ${matches.length}`);
	}

	setTimeout(() => main(), 0);
}

main();
