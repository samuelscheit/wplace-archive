import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const snapshotsPath = path.join(__dirname, "../src/ui/snapshots.json");

try {
	const data = fs.readFileSync(snapshotsPath, "utf8");
	let snapshots = JSON.parse(data);

	let now = new Date().toISOString();

	if (process.argv[2]) {
		// world-2025-12-13T21-27-14.688Z
		now = process.argv[2].replace("world-", "").replace(/T(\d+)-(\d+)-/g, "T$1:$2:");
	}

	snapshots.unshift(now);

	snapshots = Array.from(new Set(snapshots.sort((b, a) => new Date(a).getTime() - new Date(b).getTime())));

	fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, "\t"));
	console.log(`Updated snapshots.json with new timestamp: ${now}`);
} catch (err) {
	console.error("Error updating snapshots.json:", err);
	process.exit(1);
}
