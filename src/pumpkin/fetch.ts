import sharp from "sharp";
import { fetch } from "undici";
import { getDispatcher } from "./freebind.ts";
import { hasPumpkin } from "./compare.ts";
import { tlPxToGps } from "./mercator.ts";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type TileMatch = {
	tileX: number;
	tileY: number;
	offsetX: number;
	offsetY: number;
};

export async function getPumpkinEventNumber(tileX: number, tileY: number, offsetX: number, offsetY: number) {
	const { lat, lng } = tlPxToGps(tileX, tileY, offsetX, offsetY);

	const response = await fetch(`https://backend.wplace.live/s0/pixel/${tileX}/${tileY}?x=${offsetX}&y=${offsetY}`, {
		dispatcher: getDispatcher(),
	});
	const json: any = await response.json();

	console.log(
		`\n🎃 Pumpkin ${json?.paintedBy.eventClaimNumber} at lat: ${lat}, lng: ${lng} (tile: ${tileX}, ${tileY}, offset: ${offsetX}, ${offsetY})\nhttps://wplace.live/?lat=${lat}&lng=${lng}&zoom=14\n`,
	);

	return {
		lat,
		lng,
		tileX,
		tileY,
		offsetX,
		offsetY,
		number: json?.paintedBy?.eventClaimNumber as number | undefined,
	};
}

export async function fetchTile(x: number, y: number, tries = 0) {
	try {
		const response = await fetch(`https://backend.wplace.live/files/s0/tiles/${x}/${y}.png`, {
			dispatcher: getDispatcher(),
		});

		if (response.status === 404) {
			return; // no pixel has been place in this tile yet
		}

		if (response.status === 429) {
			const retryAfter = response.headers.get("Retry-After") || response.headers.get("X-RateLimit-Reset");
			if (!retryAfter) {
				throw new Error("Rate limit exceeded, but no retry-after header provided");
			}

			const retryAfterMs = parseInt(retryAfter, 10) * 1000;

			console.warn(`Rate limit exceeded, retrying after ${retryAfterMs} ms for tile ${x}, ${y}`);

			await sleep(retryAfterMs);

			return fetchTile(x, y, tries + 1);
		}

		if (!response.ok) {
			throw new Error(`Failed to fetch tile at ${x}, ${y}: ${response.statusText} (${response.status})`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		return buffer;
	} catch (error) {
		if (tries >= 3) {
			throw new Error(`Failed to fetch tile at ${x}, ${y} after 3 attempts: ${error}`);
		}

		await sleep(1000 * tries);
		return fetchTile(x, y, tries + 1);
	}
}

export async function processTile(x: number, y: number): Promise<TileMatch | undefined> {
	try {
		const buffer = await fetchTile(x, y);

		if (!buffer) {
			return;
		}

		const result = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

		const match = await hasPumpkin(result);

		if (!match) {
			return;
		}

		return {
			tileX: x,
			tileY: y,
			offsetX: match.x,
			offsetY: match.y,
		};
	} catch (error) {
		throw error instanceof Error ? error : new Error(String(error));
	}
}
