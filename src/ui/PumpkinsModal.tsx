import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PumpkinEntry } from "./types";

const PUMPKIN_ENDPOINT = "/tiles/pumpkin.json";
const POLL_INTERVAL_MS = 5_000;
const HIGHLIGHT_DURATION_MS = 60_000;

type PumpkinRaw = {
	lat: number;
	lng: number;
	tileX: number;
	tileY: number;
	offsetX: number;
	offsetY: number;
	event?: boolean;
	found?: unknown;
	foundAt?: unknown;
	found_at?: unknown;
	discoveredAt?: unknown;
	detectedAt?: unknown;
	createdAt?: unknown;
	timestamp?: unknown;
	[key: string]: unknown;
};

type PumpkinResponse = Record<string, PumpkinRaw>;

const VISITED_PUMPKINS_KEY = "wplace-visited-pumpkins";

function getVisitedPumpkins(): Map<string, Date> {
	let map = new Map<string, Date>();
	if (typeof window === "undefined") return map;
	try {
		const stored = window.localStorage.getItem(VISITED_PUMPKINS_KEY);
		if (!stored) return map;

		const parsed: Record<string, string> = JSON.parse(stored);
		for (const [key, dateStr] of Object.entries(parsed)) {
			const date = new Date(dateStr);
			if (!isNaN(date.getTime())) {
				map.set(key, date);
			}
		}
	} catch (error) {
		console.error("Failed to load visited pumpkins:", error);
	}
	return map;
}

export function PumpkinsModal({ onClose, openAbout }: { onClose: () => void; openAbout: () => void }) {
	const [pumpkins, setPumpkins] = useState<PumpkinEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(() => new Set());
	const [visitedPumpkins] = useState(() => getVisitedPumpkins());
	const [_, setForceUpdate] = useState(0);

	const abortRef = useRef<AbortController | null>(null);
	const knownKeysRef = useRef<Set<string>>(new Set());
	const highlightTimeoutsRef = useRef<Map<string, number>>(new Map());
	const mountedRef = useRef(true);
	const isFirstLoadRef = useRef(true);
	const previousFoundRef = useRef<Map<string, { date: Date | null; raw: string | undefined }>>(new Map());

	useEffect(() => {
		return () => {
			mountedRef.current = false;
			abortRef.current?.abort();
			highlightTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
			highlightTimeoutsRef.current.clear();
		};
	}, []);

	const scheduleHighlightRemoval = useCallback((keys: string[]) => {
		keys.forEach((key) => {
			if (highlightTimeoutsRef.current.has(key)) {
				return;
			}

			const timeoutId = window.setTimeout(() => {
				setHighlightedKeys((current) => {
					const next = new Set(current);
					next.delete(key);
					return next;
				});
				highlightTimeoutsRef.current.delete(key);
			}, HIGHLIGHT_DURATION_MS);

			highlightTimeoutsRef.current.set(key, timeoutId);
		});
	}, []);

	const updateHighlights = useCallback(
		(newKeys: string[]) => {
			if (newKeys.length === 0) {
				return;
			}

			setHighlightedKeys((current) => {
				const next = new Set(current);
				newKeys.forEach((key) => next.add(key));
				return next;
			});

			scheduleHighlightRemoval(newKeys);
		},
		[scheduleHighlightRemoval],
	);

	const saveVisitedPumpkins = useCallback((map: Map<string, Date>) => {
		setForceUpdate((v) => v + 1);
		if (typeof window === "undefined") return;
		try {
			let save = {} as Record<string, string>;
			visitedPumpkins.forEach((date, key) => {
				save[key] = date.toISOString();
			});
			window.localStorage.setItem(VISITED_PUMPKINS_KEY, JSON.stringify(save));
		} catch (error) {
			console.error("Failed to save visited pumpkins:", error);
		}
	}, []);

	const processResponse = useCallback(
		(raw: PumpkinResponse) => {
			const lastFullHour = new Date();
			lastFullHour.setUTCMinutes(0, 0, 0);

			let entries: PumpkinEntry[] = Object.entries(raw)
				.map(([key, value]) => {
					return {
						key,
						lat: value.lat,
						lng: value.lng,
						tileX: value.tileX,
						tileY: value.tileY,
						offsetX: value.offsetX,
						offsetY: value.offsetY,
						event: value.event,
						foundDate: new Date(value.foundAt as string),
						foundRaw: value.foundAt as string,
					};
				})
				.filter((x) => x.foundRaw && x.foundDate.getTime() >= lastFullHour.getTime());

			entries = entries.sort((a, b) => {
				const aKey = Number(a.key);
				const bKey = Number(b.key);

				const fullHourA = a.foundDate.getHours();
				const fullHourB = b.foundDate.getHours();

				if (fullHourA !== fullHourB) {
					return fullHourB - fullHourA;
				}

				return aKey - bKey;
			});

			const newKnownKeys = new Set(entries.map((entry) => entry.key));
			const previousKnown = knownKeysRef.current;
			const newKeys: string[] = [];
			const updatedKeys: string[] = [];

			for (const entry of entries) {
				if (!previousKnown.has(entry.key)) {
					newKeys.push(entry.key);
				} else {
					const prev = previousFoundRef.current.get(entry.key);
					if (prev) {
						const dateChanged = (prev.date?.getTime() ?? null) !== (entry.foundDate?.getTime() ?? null);
						const rawChanged = prev.raw !== entry.foundRaw;
						if (dateChanged || rawChanged) {
							updatedKeys.push(entry.key);
						}
					}
				}
			}

			knownKeysRef.current = newKnownKeys;

			if (!isFirstLoadRef.current) {
				updateHighlights([...newKeys, ...updatedKeys]);
			}
			isFirstLoadRef.current = false;
			setPumpkins(entries);
			setLastUpdated(new Date());

			// Update previous found data
			previousFoundRef.current.clear();
			for (const entry of entries) {
				previousFoundRef.current.set(entry.key, { date: entry.foundDate, raw: entry.foundRaw });
			}
		},
		[updateHighlights],
	);

	const fetchPumpkins = useCallback(async () => {
		if (typeof window === "undefined") {
			return;
		}

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const response = await fetch(PUMPKIN_ENDPOINT, {
				credentials: "omit",
				cache: "no-store",
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`);
			}

			const data = (await response.json()) as PumpkinResponse;
			processResponse(data);
			setError(null);
		} catch (err) {
			if ((err as Error).name === "AbortError") {
				return;
			}

			console.error("Failed to fetch pumpkins:", err);
			setError((err as Error).message || "Unknown error");
		} finally {
		}
		setLoading(false);
	}, [processResponse]);

	useEffect(() => {
		let intervalId: number | undefined;

		setLoading(true);
		fetchPumpkins().catch((error) => {
			console.error("Initial pumpkin fetch failed:", error);
		});

		intervalId = window.setInterval(() => {
			fetchPumpkins().catch((error) => {
				console.error("Pumpkin refresh failed:", error);
			});
		}, POLL_INTERVAL_MS);

		return () => {
			if (intervalId) {
				window.clearInterval(intervalId);
			}
		};
	}, [fetchPumpkins]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	const language = useMemo(() => {
		if (typeof window === "undefined") return "en";
		return window.navigator?.language ?? "en";
	}, []);

	const getLive = useCallback((entry: PumpkinEntry) => {
		const zoom = 14;
		return `https://wplace.live/?lat=${entry.lat}&lng=${entry.lng}&zoom=${zoom}`;
	}, []);

	const handlePumpkinClick = useCallback((key: string, date: Date) => {
		visitedPumpkins.set(key, date);
		saveVisitedPumpkins(visitedPumpkins);
	}, []);

	const handleCheckAll = useCallback(() => {
		const now = new Date();
		pumpkins.forEach((entry) => {
			visitedPumpkins.set(entry.key, now);
		});
		saveVisitedPumpkins(visitedPumpkins);
	}, [pumpkins]);

	const handleUncheckAll = useCallback(() => {
		visitedPumpkins.clear();
		saveVisitedPumpkins(visitedPumpkins);
	}, []);

	const renderFound = useCallback(
		(entry: PumpkinEntry) => {
			if (entry.foundDate) {
				return entry.foundDate.toLocaleString(language, {
					hour: "2-digit",
					minute: "2-digit",
				});
			}

			return;
		},
		[language],
	);

	const thisHour = new Date();
	thisHour.setUTCMinutes(0, 0, 0);

	return (
		<div
			className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center backdrop-blur-sm"
			role="presentation"
			onClick={onClose}
		>
			<div
				role="dialog"
				id="pumpkins-modal"
				aria-modal="true"
				aria-labelledby="pumpkins-modal-title"
				className="bg-white/95 text-neutral-900 max-w-xl w-[92%] rounded-lg shadow-xl p-6 space-y-4 max-h-[100vh] overflow-hidden overflow-y-auto"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 id="pumpkins-modal-title" className="text-lg font-semibold">
							Pumpkins 🎃
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400 cursor-pointer"
						aria-label="Close pumpkins dialog"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" className="size-4" aria-hidden="true">
							<path
								fill="currentColor"
								d="M310.6 361.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L160 301.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L114.7 256 9.4 150.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 210.7l105.4-105.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L205.3 256l105.3 105.4z"
							/>
						</svg>
					</button>
				</div>

				<div className="text-sm text-neutral-600">
					Thank you so much for all your kind messages and support! I'm glad I could help you all with finding the pumpkins.
					<br />
					<br />
					A huge thank you goes to all the wonderful donors who supported the project. Thanks to you the server was able to keep
					up with the crowds and handled over 112M+ requests, 104k+ visitors and served 11TB+ of data.
					<br />
					<br />
					Special thanks go to{" "}
					<a className="notranslate text-blue-900" href="https://zapto.zip/">
						zapto
					</a>{" "}
					for the discord integration,
					<br />
					to{" "}
					<a className="notranslate text-blue-900" href="https://github.com/ntanthedev">
						Đào Nhật Tân
					</a>{" "}
					who added the display for already visited pumpkins,
					<br />
					and to{" "}
					<a className="notranslate text-blue-900" href="https://xnacly.me/">
						xnacly
					</a>{" "}
					for improving the performance of the pumpking search by more than 2x to 1100 tiles per second.
					<br />
					<br />
					If you like the project and want to support it further, you can help fund the server costs by donating, sponsoring storage space, or contributing on GitHub.
					<div className="flex justify-center items-center mt-2">
					<button
						type="button"
						onClick={()=>{
							onClose()
							openAbout()
						}}
						className="inline-flex items-center gap-2 rounded bg-blue-500/70 px-4 py-2 text-sm font-semibold text-neutral-100 shadow-md backdrop-blur hover:bg-blue-600/70 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4" aria-hidden="true">
							<path
								fill="white"
								d="M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"
							/>
						</svg>
						About Wplace Archive
					</button>
					</div>
				</div>
			</div>
		</div>
	);
}
