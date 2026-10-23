import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadDirectory } from "../scripts/s3_upload_directory.ts";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
	const root = await mkdtemp(join(tmpdir(), "wplace-s3-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const tiles = join(root, "tiles");
	await mkdir(tiles);
	for (const name of ["a.png", "b.png", "c.png", "d.png", "e.png"]) await writeFile(join(tiles, name), name);
	return { root, tiles, checkpointPath: join(root, "state.jsonl") };
}

test("uploads every key once, then resumes by key despite insertion/order changes", async (t) => {
	const { tiles, checkpointPath } = await fixture(t);
	const seen: string[] = [];
	const options = { checkpointPath, concurrency: 3, uploadFile: async (_: string, key: string) => {
		await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
		seen.push(key);
	} };
	assert.deepEqual(await uploadDirectory(tiles, "tiles/release", options), { completed: 5, skipped: 0 });
	assert.equal(new Set(seen).size, 5);
	assert.equal((await readFile(checkpointPath, "utf8")).trim().split("\n").length, 5);
	await writeFile(join(tiles, "0.png"), "new, sorts first");
	assert.deepEqual(await uploadDirectory(tiles, "tiles/release", options), { completed: 1, skipped: 5 });
	assert.equal(seen.at(-1), "tiles/release/0.png");
});

test("upload failure rejects, flushes successes, and retries only unconfirmed keys", async (t) => {
	const { tiles, checkpointPath } = await fixture(t);
	await assert.rejects(uploadDirectory(tiles, "tiles/release", {
		checkpointPath, concurrency: 1, uploadFile: async (_, key) => {
			if (key.endsWith("b.png")) throw new Error("simulated failure");
		},
	}), /uploads failed/);
	const confirmed = (await readFile(checkpointPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
	assert.ok(confirmed.includes("tiles/release/a.png"));
	assert.ok(!confirmed.includes("tiles/release/b.png"));
	const seen: string[] = [];
	const result = await uploadDirectory(tiles, "tiles/release", {
		checkpointPath, uploadFile: async (_, key) => { seen.push(key); },
	});
	assert.equal(result.completed + result.skipped, 5);
	assert.ok(seen.includes("tiles/release/b.png"));
	assert.ok(!seen.includes("tiles/release/a.png"));
});

test("checkpoint cannot be reused for a different release", async (t) => {
	const { tiles, checkpointPath } = await fixture(t);
	await uploadDirectory(tiles, "tiles/first", { checkpointPath, uploadFile: async () => {} });
	await assert.rejects(uploadDirectory(tiles, "tiles/second", { checkpointPath, uploadFile: async () => {} }), /different destination/);
});

test("missing source is fatal instead of a false successful upload", async (t) => {
	const { root, checkpointPath } = await fixture(t);
	await assert.rejects(uploadDirectory(join(root, "missing"), "tiles/release", { checkpointPath }), /ENOENT/);
});
