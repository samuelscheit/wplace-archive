import { S3Client, ListBucketsCommand, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { deleteTilesPrefix } from "./s3_util.ts";

const prefixes = [
	`tiles/world-2025-10-26T14-40-45.494Z/`,
	`tiles/world-2025-10-26T11-52-41.285Z/`,
	`tiles/world-2025-10-26T09-07-07.464Z/`,
	`tiles/world-2025-10-26T06-15-51.424Z/`,
	`tiles/world-2025-10-26T03-27-59.310Z/`,
	`tiles/world-2025-10-26T00-36-39.041Z/`,
	`tiles/world-2025-10-24T14-33-49.384Z/`,
	`tiles/world-2025-10-23T18-25-00.565Z/`,
	`tiles/world-2025-10-23T15-33-07.332Z/`,
	`tiles/world-2025-10-23T12-37-09.645Z/`,
	`tiles/world-2025-10-23T09-43-55.574Z/`,
	`tiles/world-2025-10-23T06-50-34.767Z/`,
	`tiles/world-2025-10-23T03-54-42.636Z/`,
	`tiles/world-2025-10-23T01-02-19.291Z/`,
	`tiles/world-2025-10-22T19-08-33.707Z/`,
	`tiles/world-2025-10-22T16-16-49.456Z/`,
	`tiles/world-2025-10-22T07-33-28.762Z/`,
	`tiles/world-2025-10-21T22-54-33.843Z/`,
	`tiles/world-2025-10-21T20-04-24.629Z/`,
	`tiles/world-2025-10-21T17-12-25.715Z/`,
	`tiles/world-2025-10-18T19-04-33.672Z/`,
	`tiles/world-2025-08-09T20-01-14.231Z/`,
];

// await Promise.all(
// 	prefixes.map(async (prefix) => {
// 		console.log(`Deleting prefix: ${prefix}`);
// 		await deleteTilesPrefix(prefix, 1);
// 		console.log(`Deleted prefix: ${prefix}`);
// 	}),
// );

await deleteTilesPrefix(undefined, 1);
