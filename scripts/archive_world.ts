import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PQueue from "p-queue";
import { fetch } from "undici";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

type Options = {
	out: string;
	startX: number;
	startY: number;
	width: number;
	height: number;
	rps: number;
	concurrency: number;
	serverRpsLimit: number;
	freebindSubnet?: string;
	clean: boolean;
	maxAttempts: number;
};

const tileSize = 2048;

function readArg(name: string): string | undefined {
	const prefix = `--${name}=`;
	const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return arg?.slice(prefix.length);
}

function readInt(name: string, fallback: number): number {
	const raw = readArg(name) ?? process.env[`WPLACE_ARCHIVE_${name.replaceAll("-", "_").toUpperCase()}`];
	if (!raw) return fallback;

	const value = Number(raw);
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`--${name} must be a non-negative integer`);
	}

	return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
	const raw = readArg(name) ?? process.env[`WPLACE_ARCHIVE_${name.replaceAll("-", "_").toUpperCase()}`];
	if (!raw) return fallback;
	return ["1", "true", "yes"].includes(raw.toLowerCase());
}

function readOptions(): Options {
	const startX = readInt("start-x", 0);
	const startY = readInt("start-y", 0);
	const width = readInt("width", tileSize);
	const height = readInt("height", tileSize);

	if (startX + width > tileSize || startY + height > tileSize || width === 0 || height === 0) {
		throw new Error(`region must fit within ${tileSize}x${tileSize} tiles`);
	}

	return {
		out: readArg("out") ?? process.env.WPLACE_ARCHIVE_OUT ?? join(rootDir, "public", "tiles", "11"),
		startX,
		startY,
		width,
		height,
		rps: readInt("rps", 1000),
		concurrency: readInt("concurrency", 250),
		serverRpsLimit: readInt("server-rps-limit", 4),
		freebindSubnet: readArg("freebind") ?? process.env.WPLACE_IPV6_SUBNET,
		clean: readBoolean("clean", true),
		maxAttempts: readInt("max-attempts", 0),
	};
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

async function main() {
	const options = readOptions();
	const total = options.width * options.height;
	let completed = 0;
	let written = 0;
	let skipped404 = 0;
	let retried = 0;
	let lastProgressLog = Date.now();
	let pauseUntil = 0;
	let firstFailure: unknown;

	if (options.clean) {
		await rm(options.out, { recursive: true, force: true });
	}

	await mkdir(options.out, { recursive: true });

	const dispatchers = [];
	if (options.freebindSubnet) {
		const { randomDispatcher } = await import("../src/pumpkin/freebind/dispatcher.js");
		dispatchers.push(
			...Array.from({ length: Math.ceil(options.rps / options.serverRpsLimit) }, () =>
				randomDispatcher(options.freebindSubnet!, { keepAliveTimeout: 1 }),
			),
		);
	}
	let dispatcherIndex = 0;

	console.log(
		`Archiving ${total} tiles from ${options.startX},${options.startY} size ${options.width}x${options.height} to ${options.out}`,
	);
	console.log(
		`Network: rps=${options.rps} concurrency=${options.concurrency}` +
			(options.freebindSubnet ? ` freebind=${options.freebindSubnet}` : " freebind=disabled"),
	);

	const queue = new PQueue({
		concurrency: options.concurrency,
		interval: 1000,
		intervalCap: options.rps,
	});
	const targetQueueSize = Math.max(options.concurrency * 4, 1000);

	async function fetchTile(x: number, y: number): Promise<void> {
		let attempt = 0;

		while (true) {
			attempt++;

			if (Date.now() < pauseUntil) {
				await wait(pauseUntil - Date.now());
			}

			const response = await fetch(`https://backend.wplace.live/files/s0/tiles/${x}/${y}.png`, {
				dispatcher: dispatchers.length ? dispatchers[dispatcherIndex++ % dispatchers.length] : undefined,
				headers: {
					"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0",
					Accept: "image/webp,*/*",
				},
			}).catch((error: unknown) => ({ error }));

			if ("error" in response) {
				retried++;
				if (options.maxAttempts > 0 && attempt >= options.maxAttempts) throw response.error;
				await wait(Math.min(4000, 100 * 2 ** Math.min(attempt, 6)));
				continue;
			}

			if (response.status === 404) {
				skipped404++;
				return;
			}

			if (!response.ok) {
				if (!isRetryableStatus(response.status)) {
					throw new Error(`Tile ${x},${y} failed with ${response.status} ${response.statusText}`);
				}

				retried++;
				const retryAfter = Number(response.headers.get("retry-after"));
				if (Number.isFinite(retryAfter) && retryAfter > 0) {
					pauseUntil = Math.max(pauseUntil, Date.now() + retryAfter * 1000);
				}

				if (options.maxAttempts > 0 && attempt >= options.maxAttempts) {
					throw new Error(`Tile ${x},${y} still failing after ${attempt} attempts: ${response.status}`);
				}

				await wait(Math.min(4000, 100 * 2 ** Math.min(attempt, 6)));
				continue;
			}

			const bytes = new Uint8Array(await response.arrayBuffer());
			const xDir = join(options.out, String(x));
			await mkdir(xDir, { recursive: true });
			await writeFile(join(xDir, `${y}.png`), bytes);
			written++;
			return;
		}
	}

	function logProgress(force = false) {
		const now = Date.now();
		if (!force && now - lastProgressLog < 10_000) return;
		lastProgressLog = now;
		console.log(`Progress: ${completed}/${total} complete, ${written} written, ${skipped404} missing, ${retried} retries`);
	}

	for (let x = options.startX; x < options.startX + options.width; x++) {
		for (let y = options.startY; y < options.startY + options.height; y++) {
			if (firstFailure) break;
			await queue.onSizeLessThan(targetQueueSize);
			queue
				.add(async () => {
					await fetchTile(x, y);
					completed++;
					logProgress();
				})
				.catch((error: unknown) => {
					firstFailure ??= error;
					queue.clear();
				});
		}

		if (firstFailure) break;
	}

	await queue.onIdle();
	if (firstFailure) throw firstFailure;
	logProgress(true);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
