import { useState, useEffect, useCallback, useRef } from "react";
import type { MapLayerMouseEvent, MapRef } from "react-map-gl/maplibre";
import Map, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const SOURCE_ID = "neighborhoods";

const ATLANTA_CENTER = {
  longitude: -84.388,
  latitude: 33.749,
  zoom: 11,
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Paint uses feature-state for hover (GPU-direct, no React re-render)
// and feature-state for selected (set on click)
const FILL_LAYER = {
  id: "neighborhoods-fill",
  type: "fill" as const,
  source: SOURCE_ID,
  paint: {
    "fill-color": [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#4338ca",
      ["boolean", ["feature-state", "hover"], false],
      "#6366f1",
      "#4f46e5",
    ] as any,
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      0.55,
      ["boolean", ["feature-state", "hover"], false],
      0.38,
      0.18,
    ] as any,
  },
};

const LINE_LAYER = {
  id: "neighborhoods-outline",
  type: "line" as const,
  source: SOURCE_ID,
  paint: {
    "line-color": [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#3730a3",
      ["boolean", ["feature-state", "hover"], false],
      "#6366f1",
      "#4f46e5",
    ] as any,
    "line-width": [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      4,
      ["boolean", ["feature-state", "hover"], false],
      2.5,
      1.5,
    ] as any,
  },
};

function App() {
  const mapRef = useRef<MapRef>(null);
  const [data, setData] = useState<any>(null);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  // Refs to track current hover/selected IDs without triggering re-renders
  const hoveredIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}atlanta-neighborhood.geojson`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Error loading geojson:", err));
  }, []);

  // ── Hover: pure feature-state, zero React re-renders ──────────────────────
  const onMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const feature = event.features?.[0];
    const newId: number | null = feature?.properties?.OBJECTID ?? null;

    if (hoveredIdRef.current !== newId) {
      // Clear previous hover
      if (hoveredIdRef.current !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        );
      }
      // Set new hover
      if (newId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: newId }, { hover: true });
      }
      hoveredIdRef.current = newId;
    }

    map.getCanvas().style.cursor = newId !== null ? "pointer" : "";
  }, []);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (hoveredIdRef.current !== null) {
      map.setFeatureState(
        { source: SOURCE_ID, id: hoveredIdRef.current },
        { hover: false },
      );
      hoveredIdRef.current = null;
    }
    map.getCanvas().style.cursor = "";
  }, []);

  // ── Click: feature-state for selected + React state for panel ─────────────
  const onMapClick = useCallback((event: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const feature = event.features?.[0];
    const newId: number | null = feature?.properties?.OBJECTID ?? null;

    // Clear previous selection
    if (selectedIdRef.current !== null) {
      map.setFeatureState(
        { source: SOURCE_ID, id: selectedIdRef.current },
        { selected: false },
      );
    }

    // Apply new selection
    if (newId !== null) {
      map.setFeatureState({ source: SOURCE_ID, id: newId }, { selected: true });
    }

    selectedIdRef.current = newId;
    setSelectedFeature(feature ?? null);
  }, []);

  const closePanel = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && selectedIdRef.current !== null) {
      map.setFeatureState(
        { source: SOURCE_ID, id: selectedIdRef.current },
        { selected: false },
      );
    }
    selectedIdRef.current = null;
    setSelectedFeature(null);
  }, []);

  const p = selectedFeature?.properties;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* ── Map ── */}
      <Map
        ref={mapRef}
        initialViewState={ATLANTA_CENTER}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["neighborhoods-fill"]}
        onClick={onMapClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {data && (
          <Source
            id={SOURCE_ID}
            type="geojson"
            data={data}
            promoteId="OBJECTID"
          >
            <Layer {...FILL_LAYER} />
            <Layer {...LINE_LAYER} />
          </Source>
        )}
      </Map>

      {/* ── Header chip ── */}
      <div className="absolute top-5 left-5 z-10 bg-white/85 backdrop-blur-md rounded-2xl px-5 py-3.5 shadow-lg border border-white/60 pointer-events-none">
        <p className="text-[17px] font-extrabold text-indigo-950 tracking-tight leading-none">
          Atlanta Neighborhoods
        </p>
        <p className="text-[12px] text-gray-500 mt-1">
          Click a neighborhood to explore
        </p>
      </div>

      {/* ── Side panel ── */}
      {selectedFeature && p && (
        <div className="absolute top-0 right-0 h-full w-80 z-20 bg-white backdrop-blur-xl border-l border-indigo-100 shadow-[-8px_0_32px_rgba(79,70,229,0.1)] flex flex-col animate-[slideIn_0.22s_ease-out]">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-500 px-6 pt-7 pb-6 relative">
            <button
              onClick={closePanel}
              className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/35 text-white text-sm font-bold transition-colors duration-150 cursor-pointer border-0"
              aria-label="Close"
            >
              ✕
            </button>

            <span className="inline-block bg-white/15 text-indigo-200 text-[10px] font-bold uppercase tracking-widest rounded px-2.5 py-0.5 mb-2">
              {p.GEOTYPE}
            </span>

            <h2 className="m-0 text-white text-xl font-extrabold leading-tight tracking-tight">
              {p.NAME}
            </h2>

            {p.OLDNAME && p.OLDNAME !== p.NAME && (
              <p className="text-indigo-200 text-xs mt-1">
                Formerly: {p.OLDNAME}
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 border-b border-indigo-50">
            {[
              { label: "Acres", value: p.ACRES?.toFixed(1) ?? "—" },
              { label: "Sq MI", value: p.SQMILES?.toFixed(2) ?? "—" },
              { label: "NPU", value: p.NPU ?? "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="py-4 text-center border-r border-indigo-50 last:border-r-0"
              >
                <p className="text-lg font-extrabold text-indigo-600 leading-none">
                  {value}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mt-1">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-4">
              Details
            </p>

            {[
              { label: "Object ID", value: p.OBJECTID },
              { label: "Last Edited By", value: p.LAST_EDITED_USER ?? "—" },
              {
                label: "Last Edited",
                value: p.LAST_EDITED_DATE
                  ? new Date(p.LAST_EDITED_DATE).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-start py-2.5 border-b border-gray-100 last:border-0"
              >
                <span className="text-[12px] text-gray-400 font-semibold">
                  {label}
                </span>
                <span className="text-[12px] text-gray-800 font-semibold text-right max-w-40">
                  {String(value)}
                </span>
              </div>
            ))}

            <div className="mt-5">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
                Global ID
              </p>
              <p className="font-mono text-[10px] text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2 break-all leading-relaxed">
                {p.GLOBALID}
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default App;
