import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export type PumpkinEntry = {
	key: string;
	lat: number;
	lng: number;
	tileX: number;
	tileY: number;
	offsetX: number;
	offsetY: number;
	event?: boolean;
	foundDate: Date;
	foundRaw?: string;
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

function saveVisitedPumpkins(visited: Map<string, Date>): void {
	if (typeof window === "undefined") return;
	try {
		let save = {} as Record<string, string>;
		visited.forEach((date, key) => {
			save[key] = date.toISOString();
		});
		window.localStorage.setItem(VISITED_PUMPKINS_KEY, JSON.stringify(save));
	} catch (error) {
		console.error("Failed to save visited pumpkins:", error);
	}
}

export function PumpkinsModal({ onClose }: { onClose: () => void }) {
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

		setForceUpdate((v) => v + 1);
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
						{lastUpdated && (
							<p className="text-xs text-neutral-500">
								Last updated{" "}
								{lastUpdated.toLocaleTimeString(language, {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								})}
							</p>
						)}
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

				{loading && (
					<div className="text-sm text-neutral-600" role="status">
						Loading pumpkins…
					</div>
				)}

				{!loading && error && (
					<div className="text-sm text-red-600 bg-red-100/60 border border-red-200 rounded px-3 py-2">
						Failed to load pumpkins: {error}
					</div>
				)}

				{!loading && !error && pumpkins.length === 0 && <div className="text-sm text-neutral-600">No pumpkins were found.</div>}

				{pumpkins.length > 0 && (
					<div className="pr-2" style={{}}>
						{pumpkins.map((entry) => {
							const isNew = highlightedKeys.has(entry.key);
							const isVisited = visitedPumpkins.get(entry.key);
							// const visitedThisHour = isVisited && isVisited.getTime() >= thisHour.getTime();

							return (
								<div
									key={entry.key}
									className={`rounded border px-3 py-1 text-sm transition-all ${
										isNew
											? "border-amber-400 shadow-lg shadow-amber-400/30 bg-amber-50/70"
											: "border-neutral-200 bg-white/80"
									} ${isVisited ? "opacity-50" : ""}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 font-semibold text-neutral-800">
											{entry.key}
											<div className="text-neutral-500 text-xs font-normal">
												{entry.foundDate && <div>Found at {renderFound(entry)}</div>}
											</div>
											{isNew && (
												<span className="rounded bg-amber-400/80 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-amber-950 tracking-wider">
													New
												</span>
											)}
											{isVisited && (
												<span className="rounded bg-green-500/80 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-white tracking-wider flex items-center gap-1">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														viewBox="0 0 448 512"
														className="size-2.5"
														aria-hidden="true"
													>
														<path
															fill="currentColor"
															d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"
														/>
													</svg>
													Visited
												</span>
											)}
										</div>
										<a
											href={getLive(entry)}
											type="button"
											target="_blank"
											rel="noopener noreferrer"
											onClick={() => {
												handlePumpkinClick(entry.key, entry.foundDate);
											}}
											className="mt-1 inline-flex items-center gap-2 rounded bg-neutral-900/80 px-3 py-1 text-xs font-semibold text-neutral-100 shadow hover:bg-neutral-800 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
										>
											Open live
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 448 512"
												className="size-3"
												aria-hidden="true"
											>
												<path
													fill="currentColor"
													d="M432 320H416c-8.84 0-16 7.16-16 16v112H48V80h112c8.84 0 16-7.16 16-16V48c0-8.84-7.16-16-16-16H32C14.33 32 0 46.33 0 64v384c0 17.67 14.33 32 32 32h384c17.67 0 32-14.33 32-32V336c0-8.84-7.16-16-16-16zM424 0H296c-13.25 0-24 10.75-24 24v128c0 21.36 25.85 32.09 40.97 16.97l35.72-35.72L201 301.7c-6.24 6.24-6.24 16.38 0 22.62l22.63 22.62c6.25 6.24 16.38 6.24 22.63 0l147.68-147.45 35.72 35.72C335.91 249.15 346.64 224 325.28 224H456c13.25 0 24-10.75 24-24V24c0-13.25-10.75-24-24-24z"
												/>
											</svg>
										</a>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
