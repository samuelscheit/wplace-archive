import { observable } from "mobx";
import { state } from "./s3_ui_state.ts";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { awsS3 } from "./s3_client.ts";
import PQueue from "p-queue";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function deleteTilesPrefix(prefix?: string, concurrency = 1) {
	let continuationToken: string | undefined;

	const name = prefix ?? "undefined";

	const s = (state.deleting[name] ||= observable({ name, start: Date.now() }));

	const queue = new PQueue({ concurrency });

	let finished = false;

	const deleted = new Set<string>();

	while (!finished) {
		queue.add(async () => {
			s.fetchingList = true;
			const listResponse = await awsS3.send(
				new ListObjectsV2Command({
					Bucket: process.env.S3_BUCKET_NAME,
					Prefix: prefix,
					MaxKeys: 100,
					ContinuationToken: continuationToken,
				}),
			);
			s.fetchingList = false;
			s.pages = (s.pages || 0) + 1;

			s.found = (s.found || 0) + (listResponse.KeyCount || 0);

			const objects = (listResponse.Contents || []).filter((x) => !deleted.has(x.Key!));
			if (!listResponse.Contents || listResponse.Contents.length === 0) {
				console.log("No more objects to delete", listResponse.Contents?.length);
				finished = true;
				return;
			}

			s.fetchingDelete = true;

			await awsS3.send(
				new DeleteObjectsCommand({
					Bucket: process.env.S3_BUCKET_NAME!,
					Delete: {
						Objects: objects.map((obj) => ({ Key: obj.Key! })),
					},
				}),
			);

			objects.forEach((obj) => {
				deleted.add(obj.Key!);
			});

			s.fetchingDelete = false;
			s.deleted = (s.deleted || 0) + objects.length;

			if (!listResponse.IsTruncated) {
				finished = true;
				return;
			}
			continuationToken = listResponse.NextContinuationToken;
		});

		await queue.onSizeLessThan(2);
	}

	await queue.onIdle();

	s.finished = true;
}

export async function uploadToS3(opts: { key: string; content: Buffer; tries?: number }) {
	if (opts.content.length === 0 && !opts.key.includes(".")) return;

	if (opts.tries === undefined) {
		opts.tries = 0;
	}
	try {
		const url = await getSignedUrl(
			awsS3,
			new PutObjectCommand({
				Bucket: process.env.S3_BUCKET_NAME,
				Key: opts.key,
			}),
		);

		const response = await fetch(url, {
			method: "PUT",
			body: opts.content as any,
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to upload ${opts.key}: ${response.statusText} - ${text}`);
		}
	} catch (error) {
		if (opts.tries >= 3) {
			console.error(`Failed to upload ${opts.key} after ${opts.tries} tries:`, error);
			throw error;
		}

		opts.tries++;
		return uploadToS3(opts);
	}
}
