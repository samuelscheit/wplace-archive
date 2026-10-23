import * as fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { awsS3 } from "./s3_client.ts";
import PQueue from "p-queue";

type UploadOptions = {
	checkpointPath?: string;
	concurrency?: number;
	uploadFile?: (filePath: string, key: string) => Promise<void>;
};

async function* filesUnder(directory: string): AsyncGenerator<string> {
	// Do not hide traversal errors: missing files must fail the publication.
	for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) yield* filesUnder(fullPath);
		else if (entry.isFile()) yield fullPath;
		else throw new Error(`Unsupported non-regular file: ${fullPath}`);
	}
}

export async function uploadDirectory(directory: string, prefix: string, options: UploadOptions = {}) {
	const root = await fs.realpath(resolve(directory));
	prefix = prefix.replace(/^\/+|\/+$/g, "");
	const identity = JSON.stringify({ root, prefix, bucket: process.env.S3_BUCKET_NAME, endpoint: process.env.S3_ENDPOINT });
	const hash = createHash("sha256").update(identity).digest("hex");
	const checkpoint = options.checkpointPath ?? join(dirname(fileURLToPath(import.meta.url)), ".s3-upload-state", `${hash}.jsonl`);
	await fs.mkdir(dirname(checkpoint), { recursive: true });
	const metadata = `${checkpoint}.meta.json`;
	try {
		await fs.writeFile(metadata, identity, { flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		if ((await fs.readFile(metadata, "utf8")) !== identity) throw new Error("Upload checkpoint belongs to a different destination");
	}

	// Track successful object keys, never directory offsets or completion order.
	const uploaded = new Set<string>();
	try {
		for await (const line of createInterface({ input: createReadStream(checkpoint), crlfDelay: Infinity })) {
			if (line) uploaded.add(JSON.parse(line));
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	console.log(`Resuming ${prefix} from ${uploaded.size} confirmed objects; checkpoint: ${checkpoint}`);
	const handle = await fs.open(checkpoint, "a");
	let pending: string[] = [];
	let writes = Promise.resolve();
	const flush = () => {
		if (!pending.length) return writes;
		const batch = pending;
		pending = [];
		writes = writes.then(async () => {
			await handle.appendFile(batch.join("\n") + "\n", "utf8");
			await handle.sync();
		});
		return writes;
	};
	const concurrency = options.concurrency ?? Number(process.env.S3_UPLOAD_CONCURRENCY ?? 32);
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		await handle.close();
		throw new Error("S3_UPLOAD_CONCURRENCY must be a positive integer");
	}
	const queue = new PQueue({ concurrency });
	const uploadFile = options.uploadFile ?? (async (filePath, key) => {
		await awsS3.send(new PutObjectCommand({
			Bucket: process.env.S3_BUCKET_NAME,
			Key: key,
			Body: await fs.readFile(filePath),
			ContentType: filePath.endsWith(".png") ? "image/png" : "application/octet-stream",
		}));
	});
	let completed = 0;
	let skipped = 0;
	let failed = 0;
	let checkpointError: unknown;
	const report = setInterval(() => {
		console.log(`S3: ${completed} uploaded, ${skipped} skipped, ${failed} failed, ${queue.pending} active`);
		void flush().catch((error) => { checkpointError = error; });
	}, 10_000);
	report.unref();
	try {
		for await (const filePath of filesUnder(root)) {
			if (failed || checkpointError) break;
			const name = relative(root, filePath).split("\\").join("/");
			const key = prefix ? `${prefix}/${name}` : name;
			if (uploaded.has(key)) {
				skipped++;
				continue;
			}
			void queue.add(async () => {
				await uploadFile(filePath, key);
				uploaded.add(key);
				pending.push(JSON.stringify(key));
				completed++;
				if (pending.length >= 1000) await flush();
			}).catch((error) => {
				failed++;
				console.error(`Failed to upload ${key}:`, error);
			});
			await queue.onSizeLessThan(concurrency);
		}
		await queue.onIdle();
		await flush();
		if (checkpointError) throw checkpointError;
		if (failed) throw new Error(`${failed} uploads failed; snapshot must not be published`);
		console.log(`S3 complete: ${completed} uploaded, ${skipped} already present`);
		return { completed, skipped };
	} finally {
		clearInterval(report);
		await queue.onIdle();
		try { await flush(); } finally { await handle.close(); }
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		if (!process.argv[2]) throw new Error("Usage: node scripts/s3_upload_directory.ts <directory> [prefix]");
		for (const name of ["S3_BUCKET_NAME", "S3_ACCESS_KEY_ID", "S3_SECRET_KEY", "S3_REGION", "S3_ENDPOINT"]) {
			if (!process.env[name]) throw new Error(`Missing required environment variable ${name}`);
		}
		await uploadDirectory(process.argv[2], process.argv[3] ?? "");
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	} finally {
		awsS3.destroy();
	}
}
