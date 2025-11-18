import * as fs from "fs/promises";
import { join, relative, resolve } from "path";
import jsonfile from "jsonfile";
import { uploadToS3 } from "./s3_util";
import PQueue from "p-queue";

const uploadedFilesPath = join(__dirname, "uploaded_files.json");

const uploadedFiles = new Set(jsonfile.readFileSync(uploadedFilesPath, { throws: false }) || []);

setInterval(() => {
	jsonfile.writeFileSync(uploadedFilesPath, Array.from(uploadedFiles), {});
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

	queue.add(async() => {
		await uploadToS3({
			content: await fs.readFile(filePath),
			key: key,
		});
		uploadedFiles.add(filePath);
	})

	await queue.onSizeLessThan(concurrency)
}
