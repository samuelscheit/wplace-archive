import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWorkerUrl } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./index.css";
import App from "./App.tsx";

// MapLibre ships its worker as a sibling module, so it must go through Vite's worker bundler when the library is bundled.
setWorkerUrl(mapLibreWorkerUrl);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
