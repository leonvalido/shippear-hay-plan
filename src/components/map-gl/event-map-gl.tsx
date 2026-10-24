"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@/lib/events/schema";
import { ROSARIO_CENTER } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { displayTitle, formatWhen, humanizeTitle } from "@/components/events/format";
import { groupByVenue, venueOf, type Venue } from "@/components/events/venues";
import { DARK_STYLE, loadMapLibre, type GLMap, type GLPopup, type MapLibre } from "./maplibre";
import { VIOLET, VIOLET_LIGHT, VIOLET_LIGHT_SOURCE, VIOLET_SOURCE, categoryHex, loadImages, toHex } from "./paint";
import "./map-gl.css";

type Props = {
  events: Event[];
  /** Selected event: its venue pin gets a halo and is brought into view. */
  selectedId?: string | null;
  /** A venue pin was tapped. */
  onSelectVenue?: (venue: Venue) => void;
  /** A cluster was tapped at max zoom: these venues cannot be separated further. */
  onSelectCluster?: (venues: Venue[]) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Fit the view to the pins when they change. */
  fit?: boolean;
  /** Show the location button, the zoom control and cluster bubbles. */
  explore?: boolean;
  /** Called with the viewer's position after the location button succeeds. */
  onLocate?: (pos: { lat: number; lng: number }) => void;
  interactive?: boolean;
  className?: string;
};

/** Below this zoom everything is a counted violet bubble; from here on, category pins. */
const PIN_ZOOM = 14;
/** Gran Rosario with ~30 km of margin, as [west, south, east, north]. */
const AREA: [number, number, number, number] = [-61.35, -33.45, -60.15, -32.4];
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const SRC = "venues";
const ME = "me";
const RING = "rgba(255,255,255,0.18)";
const FONT = ["Open Sans Bold"];

/**
 * MapLibre GL map: vector dark basemap, venues as a clustered GeoJSON source drawn by circle and symbol layers
 * (no DOM markers). Data changes go through setData; the map itself is created once. Client-only.
 */
export function EventMap({
  events,
  selectedId,
  onSelectVenue,
  onSelectCluster,
  center = ROSARIO_CENTER,
  zoom = 13,
  fit = false,
  explore = false,
  onLocate,
  interactive = true,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap>(null);
  const popupRef = useRef<GLPopup>(null);
  const cb = useRef({ onSelectVenue, onSelectCluster, onLocate });
  cb.current = { onSelectVenue, onSelectCluster, onLocate };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const venues = useMemo(() => groupByVenue(events), [events]);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const selectedKey = venueOf(venues, selectedId)?.key ?? null;

  function locate() {
    const map = mapRef.current;
    if (!map || !("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        map.getSource(ME)?.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: {} }] });
        map.easeTo({ center: ll, zoom: Math.max(map.getZoom(), PIN_ZOOM), duration: 400 });
        cb.current.onLocate?.({ lat: ll[1], lng: ll[0] });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: GLMap = null;
    Promise.all([loadMapLibre(), loadStyle()])
      .then(([gl, style]: [MapLibre, unknown]) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        map = new gl.Map({
          container: containerRef.current,
          style,
          center: [center.lng, center.lat],
          zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: AREA,
          attributionControl: { compact: true },
          interactive,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: 150,
        });
        map.touchZoomRotate?.disableRotation();
        map.keyboard?.disableRotation?.();
        if (interactive && explore) map.addControl(new gl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-left");
        mapRef.current = map;
        // Debug handle for QA scripts (pinch/zoom checks in emulated browsers); not used by the app.
        (window as unknown as { __hpMap?: GLMap }).__hpMap = map;
        map.on("load", async () => {
          try {
            await loadImages(map);
          } catch {
            /* icons missing: pins still draw as colored circles */
          }
          if (cancelled || mapRef.current !== map) return;
          addLayers(map, explore);
          wire(map, gl, explore, cb, venuesRef, popupRef);
          setReady(true);
        });
        map.on("error", (e: { error?: Error }) => {
          // Tile and glyph hiccups are normal; only a dead style is worth telling the user about.
          if (!map.isStyleLoaded?.() && e.error && /style/i.test(e.error.message)) setError("No se pudo cargar el mapa");
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data or selection changed: one setData, no re-render of the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource(SRC)?.setData(toGeoJSON(venues, selectedKey));
  }, [venues, selectedKey, ready]);

  // Fit the view to the pins (filters changed) — never while a venue or plan panel is open (fit is false then).
  useEffect(() => {
    const map = mapRef.current;
    const gl = window.maplibregl;
    if (!ready || !map || !gl || !fit || venues.length === 0) return;
    const b = new gl.LngLatBounds();
    for (const v of venues) b.extend([v.lng, v.lat]);
    map.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 });
  }, [venues, ready, fit]);

  // Bring the selected venue into view as a pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedKey) return;
    const v = venuesRef.current.find((x) => x.key === selectedKey);
    if (!v) return;
    const visible = map.getZoom() >= PIN_ZOOM && map.getBounds().contains([v.lng, v.lat]);
    if (!visible) map.easeTo({ center: [v.lng, v.lat], zoom: Math.max(map.getZoom(), PIN_ZOOM), duration: 350 });
  }, [selectedKey, ready]);

  return (
    <div className={cn("hp-gl relative h-full w-full bg-muted", className)}>
      <div ref={containerRef} className="h-full min-h-[200px] w-full" role="application" aria-label="Mapa de eventos" />
      {explore && ready && (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label="Centrar el mapa en mi ubicación"
          title="Mi ubicación"
          className="glass absolute right-3 top-[176px] z-[1000] flex size-10 items-center justify-center rounded-full text-foreground shadow-md disabled:opacity-60 md:top-3"
        >
          <svg viewBox="0 0 24 24" className={cn("size-5", locating && "animate-pulse")} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" aria-busy>
          Cargando mapa…
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">{error}</div>}
    </div>
  );
}

/** CARTO's dark vector style; if it cannot be fetched, a darkened OSM raster style so the map still works. */
async function loadStyle(): Promise<unknown> {
  try {
    const res = await fetch(DARK_STYLE, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#110d17" } },
        { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.9, "raster-brightness-max": 0.45, "raster-contrast": 0.1, "raster-opacity": 0.9 } },
      ],
    };
  }
}

type FC = { type: "FeatureCollection"; features: unknown[] };

function toGeoJSON(venues: Venue[], selectedKey: string | null): FC {
  return {
    type: "FeatureCollection",
    features: venues.map((v, i) => ({
      type: "Feature",
      id: i + 1,
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
      properties: {
        key: v.key,
        category: v.category,
        color: categoryHex(v.category),
        mixed: new Set(v.events.map((e) => e.category)).size > 1 ? 1 : 0,
        count: v.events.length,
        selected: v.key === selectedKey ? 1 : 0,
      },
    })),
  };
}

function addLayers(map: GLMap, explore: boolean) {
  const violet = toHex(VIOLET_SOURCE, VIOLET);
  const light = toHex(VIOLET_LIGHT_SOURCE, VIOLET_LIGHT);
  const hover = ["boolean", ["feature-state", "hover"], false];
  const bubbleColor = ["case", hover, light, ["==", ["get", "selected"], 1], light, violet];
  const isCluster = ["has", "point_count"];
  const isPoint = ["!", ["has", "point_count"]];

  map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: explore, clusterRadius: 40, clusterMaxZoom: PIN_ZOOM - 1 });
  map.addSource(ME, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  // Viewer position: soft ring + blue dot.
  map.addLayer({ id: "me-ring", type: "circle", source: ME, paint: { "circle-radius": 14, "circle-color": "rgba(37,99,235,0.25)" } });
  map.addLayer({ id: "me", type: "circle", source: ME, paint: { "circle-radius": 8, "circle-color": "#2563eb", "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });

  // Clusters: flat violet 30 px circle with the count (36 px from three digits).
  map.addLayer({
    id: "clusters",
    type: "circle",
    source: SRC,
    filter: isCluster,
    paint: {
      "circle-radius": ["case", [">=", ["get", "point_count"], 100], 18, 15],
      "circle-color": bubbleColor,
      "circle-opacity": 0.92,
      "circle-stroke-width": 1,
      "circle-stroke-color": RING,
    },
  });
  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: SRC,
    filter: isCluster,
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#fff" },
  });

  if (explore) {
    // Lone venues at city zoom look like a cluster of one, so a screen never mixes bubbles and pins.
    map.addLayer({
      id: "lone",
      type: "circle",
      source: SRC,
      filter: isPoint,
      maxzoom: PIN_ZOOM,
      paint: { "circle-radius": 15, "circle-color": bubbleColor, "circle-opacity": 0.92, "circle-stroke-width": 1, "circle-stroke-color": RING },
    });
    map.addLayer({
      id: "lone-count",
      type: "symbol",
      source: SRC,
      filter: isPoint,
      maxzoom: PIN_ZOOM,
      layout: { "text-field": "1", "text-font": FONT, "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true },
      paint: { "text-color": "#fff" },
    });
  }

  const pinZoom = explore ? PIN_ZOOM : MIN_ZOOM;
  // Selected venue: a soft violet halo under the pin.
  map.addLayer({
    id: "venue-halo",
    type: "circle",
    source: SRC,
    filter: ["all", isPoint, ["==", ["get", "selected"], 1]],
    minzoom: pinZoom,
    paint: { "circle-radius": 20, "circle-color": violet, "circle-opacity": 0.35 },
  });
  // Venue pins: 26 px in the category color (brand violet when the venue mixes categories), white/18 ring.
  map.addLayer({
    id: "venues",
    type: "circle",
    source: SRC,
    filter: isPoint,
    minzoom: pinZoom,
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 15, 13],
      "circle-color": ["case", ["==", ["get", "mixed"], 1], violet, ["get", "color"]],
      "circle-stroke-width": 1,
      "circle-stroke-color": ["case", hover, "rgba(255,255,255,0.45)", RING],
    },
  });
  map.addLayer({
    id: "venue-icons",
    type: "symbol",
    source: SRC,
    filter: isPoint,
    minzoom: pinZoom,
    layout: {
      "icon-image": ["case", ["==", ["get", "mixed"], 1], "icon-stack", ["concat", "icon-", ["get", "category"]]],
      "icon-size": 1,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  // Count badge (white disc, dark number) on the pin's top-right for venues with several events.
  map.addLayer({
    id: "venue-count",
    type: "symbol",
    source: SRC,
    filter: ["all", isPoint, [">", ["get", "count"], 1]],
    minzoom: pinZoom,
    layout: {
      "icon-image": "badge",
      "icon-offset": [11.5, -10.5],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "text-field": ["to-string", ["get", "count"]],
      "text-font": FONT,
      "text-size": 10,
      "text-offset": [1.15, -1.05],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#15111a" },
  });
}

type Cb = React.MutableRefObject<{ onSelectVenue?: (v: Venue) => void; onSelectCluster?: (vs: Venue[]) => void }>;

function wire(map: GLMap, gl: MapLibre, explore: boolean, cb: Cb, venuesRef: React.MutableRefObject<Venue[]>, popupRef: React.MutableRefObject<GLPopup>) {
  const hit = ["clusters", ...(explore ? ["lone"] : []), "venues"];
  const canvas = map.getCanvas();
  let hovered: { id: number | string } | null = null;

  const setHover = (f: { id: number | string } | null) => {
    if (hovered && (!f || f.id !== hovered.id)) map.setFeatureState({ source: SRC, id: hovered.id }, { hover: false });
    if (f && (!hovered || f.id !== hovered.id)) map.setFeatureState({ source: SRC, id: f.id }, { hover: true });
    hovered = f;
  };

  map.on("mousemove", (e: { point: unknown }) => {
    const f = map.queryRenderedFeatures(e.point, { layers: hit })[0];
    canvas.style.cursor = f ? "pointer" : "";
    setHover(f?.id != null ? { id: f.id } : null);
    const key = f?.properties?.key as string | undefined;
    const venue = key && f.layer.id === "venues" ? venuesRef.current.find((v) => v.key === key) : undefined;
    if (venue) {
      popupRef.current ??= new gl.Popup({ closeButton: false, closeOnClick: false, offset: 18, className: "hp-gl-tooltip", maxWidth: "280px" });
      popupRef.current.setLngLat([venue.lng, venue.lat]).setHTML(tooltipHtml(venue)).addTo(map);
    } else {
      popupRef.current?.remove();
    }
  });
  map.on("mouseout", () => {
    setHover(null);
    popupRef.current?.remove();
  });

  map.on("click", (e: { point: unknown }) => {
    const f = map.queryRenderedFeatures(e.point, { layers: hit })[0];
    if (!f) return;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    if (f.layer.id === "clusters") {
      const src = map.getSource(SRC);
      const id = f.properties.cluster_id;
      // Fit the bubble's venues while that separates something (like fitBounds on the old cluster plugin); otherwise list them.
      Promise.all([src.getClusterLeaves(id, 500, 0), src.getClusterExpansionZoom(id)]).then(([leaves, expansion]: [{ geometry: { coordinates: [number, number] }; properties: { key: string } }[], number]) => {
        const b = new gl.LngLatBounds();
        for (const l of leaves) b.extend(l.geometry.coordinates);
        const cam = map.cameraForBounds(b, { padding: 56, maxZoom: 16 });
        const target = Math.max(cam?.zoom ?? 0, Math.min(expansion, MAX_ZOOM), map.getZoom() + 1);
        if (target <= MAX_ZOOM) return map.easeTo({ center: cam?.center ?? [lng, lat], zoom: target, duration: 500 });
        const keys = new Set(leaves.map((l) => l.properties.key));
        cb.current.onSelectCluster?.(venuesRef.current.filter((v) => keys.has(v.key)));
      });
      return;
    }
    if (f.layer.id === "lone") return map.easeTo({ center: [lng, lat], zoom: PIN_ZOOM, duration: 450 });
    const venue = venuesRef.current.find((v) => v.key === f.properties.key);
    if (venue) {
      popupRef.current?.remove();
      cb.current.onSelectVenue?.(venue);
    }
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Line 1 day · time, line 2 short title, line 3 venue (+ "Ver N eventos" when the venue holds several). */
function tooltipHtml(v: Venue) {
  const e = v.events[0];
  const more = v.events.length > 1 ? `<b class="hp-tt-pill">Ver ${v.events.length} eventos</b>` : "";
  return `<div class="hp-tt"><em>${escapeHtml(formatWhen(e))}</em><strong>${escapeHtml(displayTitle(e))}</strong><span>${escapeHtml(humanizeTitle(v.name))}</span>${more}</div>`;
}
