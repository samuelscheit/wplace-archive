import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const snapshotsPath = path.join(__dirname, "../src/ui/snapshots.json");

try {
	const data = fs.readFileSync(snapshotsPath, "utf8");
	let snapshots = JSON.parse(data);

	// const now = new Date().toISOString();
	const now = process.argv[2] || new Date().toISOString();

	snapshots.unshift(now);

	snapshots = snapshots.sort((b, a) => new Date(a).getTime() - new Date(b).getTime());

	fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, "\t"));
	console.log(`Updated snapshots.json with new timestamp: ${now}`);
} catch (err) {
	console.error("Error updating snapshots.json:", err);
	process.exit(1);
}
