import { parentPort, workerData, isMainThread } from "worker_threads";
import PQueue from "p-queue";
import { processTile } from "./fetch.ts";
import { setIPStart } from "./freebind.ts";

export type WorkerConfig = {
	startY: number;
	endY: number;
	maxX: number;
	concurrency?: number;
	ipStartOffset: string
};


async function runWorker(config: WorkerConfig) {
	const { startY, endY, maxX, concurrency = 16 } = config;

	const queue = new PQueue({
		concurrency,
	});

	setIPStart(BigInt(config.ipStartOffset));

	for (let y = startY; y < endY; y++) {
		for (let x = 0; x < maxX; x++) {
			// Throttle pending tasks to avoid unbounded memory growth.
			await queue.onSizeLessThan(concurrency * 2);

			queue.add(async () => {
				try {
					const match = await processTile(x, y);

					if (match) {
						parentPort?.postMessage({
							type: "match",
							data: match,
						});
					} else {
						parentPort?.postMessage({
							type: "no_match",
						});
					}
				} catch (error) {
					parentPort?.postMessage({
						type: "error",
						data: {
							tileX: x,
							tileY: y,
							message: error instanceof Error ? error.message : String(error),
						},
					});
				}
			});
		}
	}

	await queue.onIdle();

	parentPort?.postMessage({
		type: "done",
		data: {
			startY,
			endY,
			maxX,
		},
	});
}

console.log({ isMainThread, workerData });

if (!isMainThread && workerData) {
	runWorker(workerData as WorkerConfig).catch((error) => {
		parentPort?.postMessage({
			type: "error",
			data: {
				message: error instanceof Error ? error.message : String(error),
			},
		});
		process.exit(1);
	});
}
