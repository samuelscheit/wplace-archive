import { useLayoutEffect, useState, useRef, useCallback, useMemo, useEffect, AnchorHTMLAttributes } from "react";
import Timeline from "./Timeline";
import { addProtocol, ColorSpecification, LayerSpecification, LngLat, LngLatBounds, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./Timeline.css";
import "./App.css";
import layers from "./mapstyle.json";
import layersDark from "./mapstyle_dark.json";
import "./util";
import { getImageFromMap, inBounds } from "./util";
import { BankTransfer } from "./BankTransfer";
import { Donate } from "./Donate";
import { About } from "./About";
import { Crypto } from "./Crypto";
import { PumpkinsModal } from "./PumpkinsModal";
// @ts-ignore
import { useEvent } from "./use-event.js";

const WORLD_N = 85.0511287798066; // top latitude in EPSG:3857

// Times available for the time-travel tile layers. Use valid ISO strings (Map overlay folders use ':' replaced by '-').
const timeStrings: string[] = [
	"2025-10-30T16:31:21.825Z",
	"2025-10-24T23:09:24.923Z",
	"2025-10-18T07:23:59.887Z",
	"2025-10-11T13:55:18.919Z",
	"2025-10-04T12:28:23.768Z",
	"2025-09-22T17:49:18.014Z",
	"2025-09-13T14:53:56.640Z",
	"2025-09-09T11:58:48.527Z",
	"2025-08-25T21:47:23.259Z",
	"2025-08-22T11:34:06.282Z",
	"2025-08-09T20:01:14.231Z",
];
const defaultTimes = timeStrings.map((s) => new Date(s));

let franceTimes = [] as Date[];

const franceStart = new Date("2025-08-13T22:00:00Z");
const now = new Date();
let time = franceStart;

while (time < now) {
	franceTimes.push(new Date(time));
	time = new Date(time.getTime() + 30 * 60 * 1000); // +30 minutes
}

franceTimes = franceTimes.reverse();

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "dark";
	try {
		const stored = window.localStorage.getItem("theme");
		if (stored === "light" || stored === "dark") {
			return stored;
		}
	} catch (error) {
		// ignore storage access issues (e.g., privacy modes)
	}
	// const prefersLight = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;
	return "light";
}

function toISOString(d: Date) {
	if (isNaN(d.getTime())) return "now";

	return d.toISOString();
}

function timeSlug(d: Date) {
	if (!d) return "";
	if (isNaN(d.getTime())) return "now";

	// Folder naming: replace ':' with '-' to be filesystem friendly, keep milliseconds & Z
	return toISOString(d).replace(/:/g, "-");
}

function timeSlugFrance(d: Date) {
	if (!d) return "";
	if (isNaN(d.getTime())) return "now";

	return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}-${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

function recoverIsoFromSlug(slug: string) {
	// Convert 2025-08-31T14-13-41.477Z back to 2025-08-31T14:13:41.477Z (only replace the two '-' after 'T')
	return slug.replace(/T(\d{2})-(\d{2})-(\d{2}\.\d{3}Z)$/, (m, h, mi, rest) => `T${h}:${mi}:${rest}`);
}

function parseHash(): Record<string, string> {
	if (typeof window === "undefined") return {};
	const h = (window.location.hash || window.location.search).replace(/^#/, "").replace(/^\?/, "");
	if (!h) return {};
	const out: Record<string, string> = {};
	h.split("&").forEach((pair) => {
		const [k, v] = pair.split("=").map(decodeURIComponent);
		if (k) out[k] = v ?? "";
	});

	if (out.zoom) {
		out.z = out.zoom;
	} else if (out.z) {
		out.zoom = out.z;
	}

	return out;
}

function buildHash(params: Record<string, any>) {
	const parts = Object.entries(params)
		.filter(([, v]) => v !== undefined && v !== null && v !== "")
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
	return location.pathname + "#" + parts.join("&");
}

function updateHashParams(updates: Record<string, any>) {
	if (typeof window === "undefined") return;
	const params = parseHash();

	for (const [key, value] of Object.entries(updates)) {
		if (value === undefined || value === null || value === false || value === "") {
			delete params[key];
		} else {
			params[key] = String(value);
		}
	}

	if (Object.keys(params).length === 0) {
		if (window.location.hash) {
			window.history.replaceState(null, "", window.location.pathname + window.location.search);
		}
		return;
	}

	const newHash = buildHash(params);
	if (window.location.hash !== newHash) window.history.replaceState(null, "", newHash);
}

function App() {
	const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
	const isDarkTheme = theme === "dark";
	const [selectionChanged, setSelectionChanged] = useState(true);
	const mapRef = useRef<Map | null>(null);
	const mapReadyRef = useRef(false);
	const [forceUpdate, setForceUpdate] = useState(0);
	const [isAboutOpen, setIsAboutOpen] = useState(false);
	const [isDonateOpen, setIsDonateOpen] = useState(false);
	const [isCryptoOpen, setIsCryptoOpen] = useState(false);
	const [isBankTransferOpen, setIsBankTransferOpen] = useState(false);
	const [isPumpkinsOpen, setIsPumpkinsOpen] = useState(() => {
		if (typeof window === "undefined") return false;
		const params = parseHash();
		return params.pumpkins === "1" || params.pumpkins === "true";
	});
	let [times, setTimes] = useState<Date[]>(defaultTimes);

	const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
	const progressBarRef = useRef<HTMLProgressElement>(null);
	const progressTextRef = useRef<HTMLDivElement>(null);
	const [errorScreenshot, setErrorScreenshot] = useState<string | null>(null);

	useLayoutEffect(() => {
		if (typeof document === "undefined") return;
		document.documentElement.setAttribute("data-theme", theme);
		document.documentElement.style.colorScheme = theme;
	}, [theme]);

	useMemo(() => {
		const map = mapRef.current;
		if (!map) return;

		map.setPaintProperty("background", "background-color", isDarkTheme ? "#000000" : "#f8f4f0");

		layers.forEach((layer) => {
			map.setLayoutProperty(layer.id, "visibility", isDarkTheme ? "none" : "visible");
		});

		layersDark.forEach((layer) => {
			map.setLayoutProperty(layer.id, "visibility", isDarkTheme ? "visible" : "none");
		});

		map.triggerRepaint();
	}, [isDarkTheme, mapRef.current]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem("theme", theme);
		} catch (error) {
			// ignore storage access errors
		}
	}, [theme]);

	const toggleTheme = useCallback(() => {
		setTheme((prev) => (prev === "dark" ? "light" : "dark"));
	}, []);

	const openLive = useCallback(() => {
		const map = mapRef.current;
		if (!map) return;

		const c = map.getCenter();
		const z = map.getZoom();
		const link = `https://wplace.live/?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}&zoom=${Math.max(z, 10.61).toFixed(2)}`;

		window.open(link, "_blank");
	}, []);
	let [selectedIndex, setSelectedIndex] = useState(0);

	const themeButtonLabel = isDarkTheme ? "Switch to light mode" : "Switch to dark mode";

	// On first render, parse hash for initial state (center, zoom, time)
	const initialView = useRef<{ center?: [number, number]; zoom?: number }>({}).current;

	// Helper to apply hash params to view/time state
	function applyHashParams(
		params: Record<string, string>,
		view: { center?: [number, number]; zoom?: number; time?: string; index?: number; timeUnix?: number } = {},
	) {
		const lat = params.lat ? parseFloat(params.lat) : undefined;
		const lng = params.lng ? parseFloat(params.lng) : undefined;
		const z = params.z ? parseFloat(params.z) : undefined;
		if (isFinite(lat!) && isFinite(lng!)) view.center = [lng!, lat!];
		if (isFinite(z!)) view.zoom = z!;
		view.time = params.time;

		if (params.time) {
			view.timeUnix = new Date(recoverIsoFromSlug(params.time)).getTime();
		}

		let idx = times.findIndex((t) => timeSlug(t) === params.time);
		if (idx === -1 && params.time) {
			const isoCandidate = recoverIsoFromSlug(params.time);
			idx = times.findIndex((t) => toISOString(t) === isoCandidate);
		}

		view.index = idx !== -1 ? idx : 0;

		return view;
	}

	const currentTime = times[selectedIndex];
	let currentSlug = timeSlug(currentTime);

	useLayoutEffect(() => {
		const map = new Map({
			container: "map",
			style: {
				version: 8,
				sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
				glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
				sources: {
					ne2_shaded: {
						maxzoom: 6,
						tileSize: 256,
						tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
						type: "raster",
					},
					openmaptiles: {
						type: "vector",
						url: "https://tiles.openfreemap.org/planet",
					},
					...Object.fromEntries(
						defaultTimes.map((time) => {
							return [
								`tiles-${timeSlug(time)}`,
								{
									type: "raster",
									tiles: [`https://wplace.samuelscheit.com/tiles/world-${timeSlug(time)}/{z}/{x}/{y}.png`],
									// tileSize: TILE_SIZE,
									scheme: "xyz",
									maxzoom: 11,
								},
							];
						}),
					),
					...Object.fromEntries(
						franceTimes.map((time) => {
							return [
								`tiles-${timeSlug(time)}`,
								{
									type: "raster",
									tiles: [
										`https://wplace.zapto.zip/api/tiles/{x}/{y}/${timeSlugFrance(time)}.png?cache=true&best-effort=true`,
									],
									// tileSize: TILE_SIZE,
									scheme: "xyz",
									maxzoom: 11,
									// minzoom: 11,
								},
							];
						}),
					),
				},
				layers: [
					{
						id: "background",
						type: "background",
						paint: {
							"background-color": isDarkTheme ? "#000000" : "#f8f4f0",
						},
					},
					...(layers as any).map((l: any) => {
						if (!l.layout) l.layout = {};
						l.layout.visibility = isDarkTheme ? "none" : "visible";
						return l;
					}),
					...(layersDark as any).map((l: any) => {
						if (!l.layout) l.layout = {};
						l.layout.visibility = isDarkTheme ? "visible" : "none";
						return l;
					}),
					...[...defaultTimes, ...franceTimes].map((x) => {
						const visibility = timeSlug(x) === currentSlug ? "visible" : "none";

						return {
							id: `tiles-${timeSlug(x)}`,
							type: "raster",
							source: `tiles-${timeSlug(x)}`,
							paint: {
								"raster-resampling": "nearest",
								"raster-opacity": 1,
							},
							layout: {
								visibility, // visible
								// visibility: "visible", // visible
							},
						};
					}),
				],
			},
			renderWorldCopies: false,
			center: initialView.center || [0, WORLD_N / 3],
			zoom: initialView.zoom ?? 2,
		});

		mapRef.current = map;
		// @ts-ignore
		globalThis.map = map;
		map.on("load", () => {
			mapReadyRef.current = true;
			setForceUpdate((i) => i + 1);
		});

		// React to manual hash edits
		const onHashChange = () => {
			const params = parseHash();
			applyParamsToMap(params);
			const shouldOpenPumpkins = params.pumpkins === "1" || params.pumpkins === "true";
			setIsPumpkinsOpen(shouldOpenPumpkins);
		};
		window.addEventListener("hashchange", onHashChange);

		return () => {
			map.remove();
			mapRef.current = null;
			mapReadyRef.current = false;
			window.removeEventListener("hashchange", onHashChange);
		};
		// re-create map only once; time changes handled separately
	}, []);

	const updateVisiblityLayers = useEvent(function updateVisiblityLayers() {
		if (!currentSlug) return;

		const map = mapRef.current;
		if (!map || !mapReadyRef.current) return;

		const layer = map.getLayer(`tiles-${currentSlug}`);
		if (!layer) return;

		map.setLayoutProperty(`tiles-${currentSlug}`, "visibility", "visible");
		map.setPaintProperty(`tiles-${currentSlug}`, "raster-opacity", 1);
		const interval = setInterval(() => {
			if (map.areTilesLoaded()) {
				clearInterval(interval);

				const otherLayers =
					map.getStyle().layers?.filter((l) => l.id.startsWith("tiles-") && l.id !== `tiles-${currentSlug}`) || [];
				otherLayers.forEach((l) => {
					const otherLayer = map.getLayer(l.id);
					if (!otherLayer) return;

					map.setPaintProperty(l.id, "raster-opacity", 0);
					if (selectionChanged) {
						setTimeout(() => {
							// map.setLayoutProperty(l.id, "visibility", "visible");
						}, 100);
					}
				});

				map.triggerRepaint();
			}
		}, 30);

		return interval;
	});

	const syncTimes = useEvent((c?: LngLat, z?: number, selectedTime?: number) => {
		if (!c || z === undefined) {
			const map = mapRef.current;
			if (!map) return;

			c = map.getCenter();
			z = map.getZoom();
		}

		// inBounds(lat, lng, south, west, north, east) — Metropolitan France (incl. Corsica) with small margin
		const inFrance =
			inBounds(c.lat, c.lng, [
				35.79829, // south
				-10.02003, // west
				51.50873, // north
				6.67969, // east
			]) && z >= 11;

		let newTimes = times;

		if (inFrance) {
			newTimes = franceTimes;
		} else {
			newTimes = defaultTimes;
		}

		if (newTimes !== times) {
			if (!selectedTime) selectedTime = times[selectedIndex]?.getTime() || Date.now();

			times = newTimes;
			setTimes(newTimes);

			// find nearest time index
			let nearestIndex = 0;
			let nearestDiff = Infinity;
			newTimes.forEach((t, idx) => {
				const diff = Math.abs(t.getTime() - selectedTime!);
				if (diff < nearestDiff) {
					nearestDiff = diff;
					nearestIndex = idx;
				}
			});
			if (nearestIndex !== selectedIndex) {
				setSelectedIndex(nearestIndex);
				selectedIndex = nearestIndex;
				currentSlug = timeSlug(newTimes[nearestIndex]);
				updateVisiblityLayers();
			}
		}
	});

	// Wrapper applying params directly to a live map instance
	const applyParamsToMap = useCallback((params: Record<string, string>) => {
		const m = mapRef.current;
		const view = applyHashParams(params, {});
		if (!m) return;
		if (view.center) m.setCenter(view.center);
		if (view.zoom !== undefined) m.setZoom(view.zoom);

		syncTimes();
	}, []);

	// Central hash sync (uses current map + selected time)
	const syncHash = useEvent(
		(index = selectedIndex, selChanged = selectionChanged) => {
			if (typeof index !== "number") index = selectedIndex;
			const map = mapRef.current;
			if (!map) return;

			const c = map.getCenter();
			const z = map.getZoom();
			const currentTimeLocal = times[index];
			const slug = timeSlug(currentTimeLocal);
			updateHashParams({
				z: z.toFixed(2),
				lat: c.lat.toFixed(5),
				lng: c.lng.toFixed(5),
				time: slug,
				pumpkins: isPumpkinsOpen ? "1" : undefined,
			});
			setSelectionChanged(false);

			if (selChanged) return;

			// unload all other layers which aren't active
			const otherLayers = map.getStyle()?.layers?.filter((l) => l.id.startsWith("tiles-") && l.id !== `tiles-${currentSlug}`) || [];
			otherLayers.forEach((l) => {
				const otherLayer = map.getLayer(l.id);
				if (!otherLayer) return;

				map.setLayoutProperty(l.id, "visibility", "none");
			});
		},
		[selectedIndex, selectionChanged],
	);

	if (!initialView.center) {
		const params = parseHash();
		const p = applyHashParams(params, initialView);
		let pendingIndex = p.index || 0;
		if (p.center) {
			syncTimes(
				{
					lat: p.center[1],
					lng: p.center[0],
				},
				p.zoom || 2,
				p.timeUnix,
			);
		}
		if (p.index !== pendingIndex) setSelectedIndex(pendingIndex);
	}

	useLayoutEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const remove = map.on("moveend", syncHash);
		const remove2 = map.on("moveend", () => syncTimes());

		return () => {
			remove.unsubscribe();
			remove2.unsubscribe();
		};
	}, [syncHash]);

	// Update raster source when the selected time changes
	useLayoutEffect(() => {
		const map = mapRef.current;
		if (!map || !mapReadyRef.current) return;

		const interval = updateVisiblityLayers();

		return () => {
			map.triggerRepaint();
			clearInterval(interval);
		};
	}, [currentSlug, forceUpdate]);

	const onSelect = useCallback((idx: number) => {
		setSelectedIndex(idx);
		syncHash(idx, true);
	}, []);

	const takeScreenshot = async () => {
		setIsTakingScreenshot(true);
		if (!mapRef.current) return;

		let canvas = undefined as any as OffscreenCanvas;

		try {
			const source = mapRef.current.getSource(`tiles-${currentSlug}`);
			if (!source) throw new Error("No source found for current tiles");

			const generator = getImageFromMap(mapRef.current, source);
			for await (const update of generator) {
				if (update.type === "start") {
					// canvas is ready
					canvas = update.canvas as any;
				} else if (update.type === "progress" && update.loaded !== undefined) {
					if (progressBarRef.current) {
						progressBarRef.current.value = update.loaded / update.total;
					}
					if (progressTextRef.current) {
						progressTextRef.current.textContent = `Progress: ${Math.round((update.loaded / update.total) * 100)}%`;
					}
				}
			}

			const blob = await canvas.convertToBlob({
				type: "image/png",
			});

			const a = document.createElement("a");

			const url = URL.createObjectURL(blob);
			a.href = url;
			a.download = "wplace.png";
			a.click();
			URL.revokeObjectURL(url);

			setIsTakingScreenshot(false);

			// @ts-ignore
			globalThis?.plausible?.("screenshot");
		} catch (error) {
			// @ts-ignore
			globalThis?.plausible?.("screenshot_error");
			console.error("Screenshot error", error);
			if (error instanceof Error && error.message.includes("Maximum call stack size exceeded")) {
				setErrorScreenshot("The requested screenshot is too large. Please zoom further in and try again.");
			} else {
				setErrorScreenshot((error as Error).message);
			}
		}
	};

	const openAbout = useCallback(() => {
		// @ts-ignore
		globalThis?.plausible?.("about");

		const lang = globalThis.navigator?.language?.split("-")[0] || "en";
		// @ts-ignore
		globalThis.googleTranslateElementInit = () => {
			console.log("init translate");
			document.cookie = `googtrans=/en/${lang}; path=/; `;
			// @ts-ignore
			new google.translate.TranslateElement(
				// @ts-ignore
				{ pageLanguage: "en", layout: google.translate.TranslateElement.InlineLayout.HORIZONTAL },
				"google_translate_element",
			);
		};
		const script = document.createElement("script");
		script.type = "text/javascript";
		script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

		if (
			!document.querySelector('script[src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"]') &&
			lang !== "en"
		) {
			globalThis.document.body.appendChild(script);
		}

		setIsAboutOpen(true);
	}, []);
	const closeAbout = useCallback(() => setIsAboutOpen(false), []);
	const openDonate = useCallback(() => {
		// @ts-ignore
		globalThis?.plausible?.("donate");

		setIsDonateOpen(true);
	}, []);
	const closeDonate = useCallback(() => setIsDonateOpen(false), []);
	const openBankTransfer = useCallback(() => {
		setIsBankTransferOpen(true);
	}, []);
	const closeBankTransfer = useCallback(() => setIsBankTransferOpen(false), []);
	const openCrypto = useCallback(() => {
		setIsCryptoOpen(true);
	}, []);
	const closeCrypto = useCallback(() => setIsCryptoOpen(false), []);
	const closePumpkins = useCallback(() => setIsPumpkinsOpen(false), []);

	useEffect(() => {
		updateHashParams({ pumpkins: isPumpkinsOpen ? "1" : undefined });
	}, [isPumpkinsOpen]);

	useEffect(() => {
		if (!isAboutOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeAbout();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isAboutOpen, closeAbout]);

	useEffect(() => {
		if (!isDonateOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeDonate();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isDonateOpen, closeDonate]);

	useEffect(() => {
		if (!isBankTransferOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeBankTransfer();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isBankTransferOpen, closeBankTransfer]);

	return (
		<>
			<div id="map" />
			<div className="absolute left-2 top-2 flex flex-col gap-2 z-10 text-xs font-medium text-neutral-100 justify-start items-start">
				<button
					type="button"
					onClick={openAbout}
					className="rounded bg-neutral-900/70 px-3 py-1 shadow-md backdrop-blur font-semibold flex flex-row items-center gap-2 cursor-pointer hover:bg-neutral-800/70 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-200"
					aria-haspopup="dialog"
					aria-expanded={isAboutOpen}
					aria-controls="about-modal"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-3" aria-hidden="true">
						<path
							fill="currentColor"
							d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM224 160a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm-8 64l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z"
						/>
					</svg>
					About
				</button>
				<div className="pointer-events-none rounded bg-neutral-900/70 px-3 py-1 shadow-md backdrop-blur">
					<span className="text-neutral-400 mr-1">Current:</span>
					{isNaN(currentTime.getTime())
						? "Now"
						: currentTime?.toLocaleString(window.navigator.language, {
								month: "short",
								day: "2-digit",
								hour: "2-digit",
								minute: "2-digit",
							})}
				</div>
			</div>
			<div className="absolute right-2 top-2 z-10 flex flex-col gap-2 items-end">
				<button
					onClick={() => {
						// setIsTakingScreenshot(true);
						takeScreenshot();
					}}
					disabled={isTakingScreenshot}
					className="rounded bg-neutral-900/70 px-3 py-1 text-xs font-medium text-neutral-100 shadow-md backdrop-blur hover:bg-neutral-800/70 disabled:opacity-50 flex flex-row items-center gap-2"
				>
					{isTakingScreenshot ? "Taking..." : "Screenshot"}
					{!isTakingScreenshot && (
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="inline size-[11px]">
							<path
								fill="currentColor"
								d="M149.1 64.8L138.7 96 64 96C28.7 96 0 124.7 0 160L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64l-74.7 0-10.4-31.2C356.4 45.2 338.1 32 317.4 32L194.6 32c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"
							/>
						</svg>
					)}
				</button>
				<button
					type="button"
					onClick={toggleTheme}
					className="rounded bg-neutral-900/70 px-3 py-1 text-xs font-medium text-neutral-100 shadow-md backdrop-blur hover:bg-neutral-800/70 flex flex-row items-center gap-2"
					aria-pressed={isDarkTheme}
					aria-label={themeButtonLabel}
					title={themeButtonLabel}
				>
					{isDarkTheme ? "Light Mode" : "Dark Mode"}

					{isDarkTheme ? (
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="inline size-3">
							<g fill="none">
								<g fill="currentColor" clip-path="url(#SVGXv8lpc2Y)">
									<path d="M12 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1M4.929 3.515a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 0 0 1.414-1.414zM1 11a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zm17 1a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1m-.343 4.243a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 1 0 1.414-1.414zm-9.9 1.414a1 1 0 1 0-1.414-1.414L3.515 19.07a1 1 0 1 0 1.414 1.414zM20.485 4.929a1 1 0 0 0-1.414-1.414l-2.828 2.828a1 1 0 1 0 1.414 1.414zM13 19a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0zm-1-3a4 4 0 1 0 0-8a4 4 0 0 0 0 8" />
								</g>
								<defs>
									<clipPath id="SVGXv8lpc2Y">
										<path fill="#fff" d="M0 0h24v24H0z" />
									</clipPath>
								</defs>
							</g>
						</svg>
					) : (
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="inline size-3">
							<path
								fill="currentColor"
								d="M12 21q-3.75 0-6.375-2.625T3 12t2.625-6.375T12 3q.35 0 .688.025t.662.075q-1.025.725-1.638 1.888T11.1 7.5q0 2.25 1.575 3.825T16.5 12.9q1.375 0 2.525-.613T20.9 10.65q.05.325.075.662T21 12q0 3.75-2.625 6.375T12 21"
							/>
						</svg>
					)}
				</button>
				<button
					type="button"
					className="rounded bg-neutral-900/70 px-3 py-1 text-xs font-medium text-neutral-100 shadow-md backdrop-blur hover:bg-neutral-800/70 flex flex-row items-center gap-2"
					onClick={openLive}
				>
					Open Live
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="inline size-2">
						<path
							fill="currentColor"
							d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0-201.4 201.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 96C35.8 96 0 131.8 0 176L0 432c0 44.2 35.8 80 80 80l256 0c44.2 0 80-35.8 80-80l0-80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 80c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l80 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 96z"
						/>
					</svg>
				</button>
			</div>
			{isTakingScreenshot && (
				<div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center" role="presentation">
					{errorScreenshot ? (
						<div className="bg-white p-4 rounded shadow-lg text-black max-w-md text-center flex flex-col items-center">
							<p className="whitespace-pre-wrap">{errorScreenshot}</p>

							<button
								onClick={() => {
									setErrorScreenshot(null);
									setIsTakingScreenshot(false);
								}}
								className="mt-4 rounded bg-neutral-900/70 px-3 py-1 text-xs font-medium text-neutral-100 shadow-md backdrop-blur hover:bg-neutral-800/70"
							>
								Close
							</button>
						</div>
					) : (
						<div className="bg-white p-4 rounded shadow-lg text-black">
							<div className="text-sm mb-2">Generating screenshot...</div>
							<div ref={progressTextRef} className="text-xs mb-2">
								Progress: 0%
							</div>
							<progress ref={progressBarRef} max={1} className="w-full mb-4" />
							{/* <canvas
							ref={(r) => {
								previewCanvasRef.current = r;
								if (!r) return;
								console.log("ref changed", r);
								takeScreenshot();
							}}
							style={{ width: "200px", height: "200px" }}
							className="border"
						/> */}
						</div>
					)}
				</div>
			)}
			{/* Timeline overlay */}
			<div className="absolute left-0 right-0 bottom-0 z-10 bg-gradient-to-t from-neutral-900/80 to-neutral-900/40">
				<Timeline dates={times} selectedIndex={selectedIndex} onSelect={onSelect} />
			</div>
			{isAboutOpen && <About closeAbout={closeAbout} mapRef={mapRef} openBankTransfer={openBankTransfer} openDonate={openDonate} />}
			{isBankTransferOpen && <BankTransfer closeBankTransfer={closeBankTransfer} />}
			{isDonateOpen && <Donate openBankTransfer={openBankTransfer} closeDonate={closeDonate} openCrypto={openCrypto} />}
			{isCryptoOpen && <Crypto closeCrypto={closeCrypto} />}
			{isPumpkinsOpen && <PumpkinsModal onClose={closePumpkins} openAbout={openAbout} />}
		</>
	);
}

export default App;
