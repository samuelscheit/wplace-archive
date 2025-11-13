import * as fs from "fs/promises";
import { join, relative, resolve } from "path";
import jsonfile from "jsonfile";
import { uploadToS3 } from "./s3_util";

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

console.log(`Reading files from directory: ${directoryPath}`);

for await (const filePath of readDirRecursive(directoryPath)) {
	const key = prefix + "/" + relative(directoryPath, filePath);
	console.log(`Found file: ${key}`);

	// uploadToS3({
	// 	content: await fs.readFile(filePath),
	// 	key: key,
	// });
	// uploadedFiles.add(filePath);
	// Here you would add your S3 upload logic
}
