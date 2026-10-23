import * as fs from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { ListObjectsV2Command, type ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { awsS3 } from "./s3_client.ts";

export async function verifySnapshot(
	directory: string,
	prefix: string,
	list = (token?: string): Promise<ListObjectsV2CommandOutput> => awsS3.send(new ListObjectsV2Command({
		Bucket: process.env.S3_BUCKET_NAME,
		Prefix: prefix.replace(/\/+$/, "") + "/",
		MaxKeys: 1000,
		ContinuationToken: token,
	})),
) {
	const root = resolve(directory);
	prefix = prefix.replace(/^\/+|\/+$/g, "");
	const expected = new Map<string, number>();
	async function scan(dir: string) {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			const file = join(dir, entry.name);
			if (entry.isDirectory()) await scan(file);
			else if (entry.isFile()) expected.set(`${prefix}/${relative(root, file)}`, (await fs.stat(file)).size);
			else throw new Error(`Unsupported non-regular file: ${file}`);
		}
	}
	await scan(root);
	if (!expected.size) throw new Error("Refusing to verify an empty snapshot");
	const total = expected.size;
	console.log(`Verifying ${total} local files against S3 object keys and byte sizes`);
	let token: string | undefined;
	let checked = 0;
	do {
		const response = await list(token);
		for (const object of response.Contents ?? []) {
			if (!object.Key || !expected.has(object.Key)) throw new Error(`Unexpected S3 object: ${object.Key}`);
			if (expected.get(object.Key) !== object.Size) throw new Error(`Size mismatch: ${object.Key}`);
			expected.delete(object.Key);
			checked++;
		}
		if (checked % 100_000 === 0) console.log(`Verified ${checked}/${total} S3 objects`);
		token = response.IsTruncated ? response.NextContinuationToken : undefined;
		if (response.IsTruncated && !token) throw new Error("S3 listing was truncated without a continuation token");
	} while (token);
	if (expected.size) throw new Error(`Missing ${expected.size} S3 objects, including ${expected.keys().next().value}`);
	console.log(`Verified all ${checked} S3 objects for ${prefix}`);
	return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		if (!process.argv[2] || !process.argv[3]) throw new Error("Usage: node scripts/verify_s3_snapshot.ts <directory> <prefix>");
		await verifySnapshot(process.argv[2], process.argv[3]);
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	} finally {
		awsS3.destroy();
	}
}
