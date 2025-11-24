import * as fs from "fs/promises";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import jsonfile from "jsonfile";
import { uploadToS3 } from "./s3_util.ts";
import PQueue from "p-queue";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadedFilesPath = join(__dirname, "uploaded_files.txt");
const legacyUploadedFilesPath = join(__dirname, "uploaded_files.json");

function migrateUploadedFiles(): Set<string> {
	const normalize = (content: string) =>
		content
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

	if (existsSync(uploadedFilesPath)) {
		return new Set(normalize(readFileSync(uploadedFilesPath, "utf-8")));
	}

	const legacy = jsonfile.readFileSync(legacyUploadedFilesPath, { throws: false }) || [];
	const entries = Array.isArray(legacy) ? legacy : normalize(String(legacy ?? ""));
	writeFileSync(
		uploadedFilesPath,
		entries.length ? entries.join("\n") + "\n" : "",
		"utf-8"
	);
	return new Set(entries);
}

const uploadedFiles = migrateUploadedFiles();
const addedUploadedFIles: string[] = [];

setInterval(() => {
	if (!addedUploadedFIles.length) {
		return;
	}
	const pending = addedUploadedFIles.splice(0, addedUploadedFIles.length);
	void fs
		.appendFile(uploadedFilesPath, pending.join("\n") + "\n", "utf-8")
		.catch(() => {});
}, 1000 * 10);

async function* readDirRecursive(dir: string): AsyncGenerator<string> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				yield* readDirRecursive(fullPath);
			} else if (entry.isFile()) {
				yield fullPath;
			}
		}
	} catch (error) {}
}

const args = process.argv.slice(2);
if (args.length < 1) {
	console.error("Usage: ts-node scripts/s3_upload_directory.ts <directory_path>");
	process.exit(1);
}

const directoryPath = resolve(args[0]);
const prefix = args[1] || "";
const concurrency = 1000;

const queue = new PQueue({ concurrency });

console.log(`Reading files from directory: ${directoryPath}`);

let i = uploadedFiles.size

for await (const filePath of readDirRecursive(directoryPath)) {
	const key = prefix + "/" + relative(directoryPath, filePath);

	process.stdout.write(`\r${i++} - Uploading: ${key}               `);

	queue.add(async () => {
		await uploadToS3({
			content: await fs.readFile(filePath),
			key: key,
		});
		const sizeBefore = uploadedFiles.size;
		uploadedFiles.add(filePath);
		if (uploadedFiles.size !== sizeBefore) {
			addedUploadedFIles.push(filePath);
		}
	})

	await queue.onSizeLessThan(concurrency)
}
