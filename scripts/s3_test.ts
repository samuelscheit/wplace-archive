import { S3Client, ListBucketsCommand, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { deleteTilesPrefix } from "./s3_util.ts";

await deleteTilesPrefix(undefined, 100);
