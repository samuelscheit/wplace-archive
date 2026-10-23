import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifySnapshot } from "../scripts/verify_s3_snapshot.ts";

test("S3 verification checks all pages, missing files, extra files and byte sizes", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "wplace-verify-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "a.png"), "abc");
	await writeFile(join(root, "b.png"), "de");
	const a = { Key: "tiles/release/a.png", Size: 3 };
	const b = { Key: "tiles/release/b.png", Size: 2 };
	assert.equal(await verifySnapshot(root, "tiles/release", async (token) => token
		? { Contents: [b], $metadata: {} }
		: { Contents: [a], IsTruncated: true, NextContinuationToken: "page2", $metadata: {} }), 2);
	await assert.rejects(verifySnapshot(root, "tiles/release", async () => ({ Contents: [a], $metadata: {} })), /Missing 1/);
	await assert.rejects(verifySnapshot(root, "tiles/release", async () => ({ Contents: [{ ...a, Size: 4 }], $metadata: {} })), /Size mismatch/);
	await assert.rejects(verifySnapshot(root, "tiles/release", async () => ({ Contents: [{ Key: "tiles/release/c.png", Size: 1 }], $metadata: {} })), /Unexpected/);
	await assert.rejects(verifySnapshot(root, "tiles/release", async () => ({ Contents: [a], IsTruncated: true, $metadata: {} })), /continuation token/);
});
