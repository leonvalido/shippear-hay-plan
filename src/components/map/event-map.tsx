"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@/lib/events/schema";
import { ROSARIO_CENTER } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/components/events/format";
import { groupByVenue, venueOf, type Venue } from "@/components/events/venues";
import { loadLeaflet, loadMarkerCluster, type LeafletMap, type LeafletMarker } from "./leaflet";

type Props = {
  events: Event[];
  /** Selected event: its venue pin is highlighted and centered. */
  selectedId?: string | null;
  /** A venue pin was tapped. */
  onSelectVenue?: (venue: Venue) => void;
  /** A cluster was tapped at max zoom: these venues cannot be separated further. */
  onSelectCluster?: (venues: Venue[]) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Fit the view to the pins when they change. */
  fit?: boolean;
  /** Show the location button and cluster pins. */
  explore?: boolean;
  /** Called with the viewer's position after the location button succeeds. */
  onLocate?: (pos: { lat: number; lng: number }) => void;
  interactive?: boolean;
  className?: string;
};

/** Below this zoom everything is a counted bubble; from here on, venue pins. */
const PIN_ZOOM = 14;

// OSM tiles, darkened with a CSS filter in dark mode (CARTO basemaps now require an API key).
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Leaflet map with one pin per venue (dominant category color, count badge). Client-only. */
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
  const mapRef = useRef<LeafletMap>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const layerRef = useRef<LeafletMarker>(null);
  const meRef = useRef<LeafletMarker>(null);
  const cb = useRef({ onSelectVenue, onSelectCluster, onLocate });
  cb.current = { onSelectVenue, onSelectCluster, onLocate };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [zoomTick, setZoomTick] = useState(0);

  const venues = useMemo(() => groupByVenue(events), [events]);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const selectedKey = venueOf(venues, selectedId)?.key ?? null;

  function locate() {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (!meRef.current) {
          meRef.current = L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
            .bindTooltip("Estás acá", { direction: "top", offset: [0, -8] })
            .addTo(map);
        } else {
          meRef.current.setLatLng(ll);
        }
        map.setView(ll, Math.max(map.getZoom(), 14), { animate: false });
        cb.current.onLocate?.({ lat: ll[0], lng: ll[1] });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const onWindowResize = () => mapRef.current?.invalidateSize();
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        if (containerRef.current.clientHeight === 0) {
          requestAnimationFrame(() => setRetry((n) => n + 1));
          return;
        }
        const map = L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom,
          preferCanvas: true,
          // Animations left the tile layer half-rendered on phones (tiles stuck mid zoom transition).
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          zoomControl: interactive,
          dragging: interactive,
          scrollWheelZoom: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
          keyboard: interactive,
          tap: interactive,
        });
        L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19, updateWhenIdle: false, keepBuffer: 4 }).addTo(map);
        map.on("load", () => map.invalidateSize());
        mapRef.current = map;
        const start = () => {
          if (cancelled || mapRef.current !== map) return;
          if (explore && L.markerClusterGroup) {
            const group = L.markerClusterGroup({
              maxClusterRadius: 40,
              disableClusteringAtZoom: PIN_ZOOM,
              showCoverageOnHover: false,
              spiderfyOnMaxZoom: false,
              zoomToBoundsOnClick: false, // handled below so we can decide before the zoom happens
              iconCreateFunction: (cluster: { getChildCount: () => number }) => bubbleIcon(L, cluster.getChildCount()),
            }).addTo(map);
            // Singletons switch between bubble and pin with the zoom, so one screen never mixes both styles.
            map.on("zoomend", () => setZoomTick((n) => n + 1));
            group.on("clusterclick", (e: { layer: { getBounds: () => unknown; getAllChildMarkers: () => LeafletMarker[] } }) => {
              // Zoom to the bubble's bounds while that separates something; otherwise list its venues in the sheet.
              const bounds = e.layer.getBounds();
              const z = map.getBoundsZoom(bounds);
              if (z > map.getZoom() && map.getZoom() < map.getMaxZoom()) {
                map.fitBounds(bounds, { padding: [24, 24], animate: false, maxZoom: Math.max(PIN_ZOOM, z) });
                return;
              }
              const keys = new Set(e.layer.getAllChildMarkers().map((m: LeafletMarker) => m.options.venueKey as string));
              cb.current.onSelectCluster?.(venuesRef.current.filter((v) => keys.has(v.key)));
            });
            layerRef.current = group;
          }
          setReady(true);
        };
        if (explore) loadMarkerCluster().then(start, start);
        else start();
        requestAnimationFrame(() => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 300);
        setTimeout(() => map.invalidateSize(), 1000);
        window.addEventListener("resize", onWindowResize);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onWindowResize);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  // Sync venue pins.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!ready || !map || !L) return;
    const target = layerRef.current ?? map;
    const markers = markersRef.current;
    const seen = new Set<string>();
    for (const v of venues) {
      seen.add(v.key);
      let m = markers.get(v.key);
      if (!m) {
        m = L.marker([v.lat, v.lng], { icon: iconFor(L, map, v, false, explore), venueKey: v.key, riseOnHover: true });
        m.bindTooltip(v.name, { direction: "top", offset: [0, -14] });
        m.on("click", () => {
          // At city zoom a lone bubble behaves like a cluster: zoom in to pin mode first.
          if (explore && map.getZoom() < PIN_ZOOM) return map.setView(m.getLatLng(), PIN_ZOOM, { animate: false });
          cb.current.onSelectVenue?.(venuesRef.current.find((x) => x.key === v.key) ?? v);
        });
        target.addLayer(m);
        markers.set(v.key, m);
      } else {
        m.setLatLng([v.lat, v.lng]);
        m.setIcon(iconFor(L, map, v, v.key === selectedKey, explore));
      }
    }
    for (const [key, m] of markers) {
      if (!seen.has(key)) {
        target.removeLayer(m);
        markers.delete(key);
      }
    }
    if (fit && seen.size > 0) {
      const group = L.featureGroup([...markers.values()]);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15, animate: false });
      setTimeout(() => map.invalidateSize({ pan: false }), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, ready, fit]);

  // Zoom crossed the bubble/pin threshold: swap singleton icons (never re-fit here).
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!ready || !map || !L || !explore) return;
    for (const v of venues) markersRef.current.get(v.key)?.setIcon(iconFor(L, map, v, v.key === selectedKey, explore));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomTick]);

  // Highlight the selected venue and bring it into view.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!ready || !map || !L) return;
    for (const v of venues) {
      const m = markersRef.current.get(v.key);
      if (!m) continue;
      const sel = v.key === selectedKey;
      m.setIcon(iconFor(L, map, v, sel, explore));
      if (sel) {
        m.setZIndexOffset(1000);
        const show = () => map.panTo(m.getLatLng(), { animate: false });
        if (layerRef.current?.zoomToShowLayer) layerRef.current.zoomToShowLayer(m, show);
        else show();
      } else {
        m.setZIndexOffset(0);
      }
    }
  }, [selectedKey, venues, ready, zoomTick]);

  // Leaflet needs a resize nudge when its container changes size (sheet toggles, orientation).
  useEffect(() => {
    if (!ready || !containerRef.current || !mapRef.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  return (
    <div className={cn("relative h-full w-full bg-muted", className)}>
      <div ref={containerRef} className="h-full min-h-[200px] w-full" role="application" aria-label="Mapa de eventos" />
      {explore && ready && (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label="Centrar el mapa en mi ubicación"
          title="Mi ubicación"
          className="glass absolute right-3 top-3 z-[1000] flex size-10 items-center justify-center rounded-full text-foreground shadow-md disabled:opacity-60"
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

/* eslint-disable @typescript-eslint/no-explicit-any */
function iconFor(L: any, map: LeafletMap, v: Venue, selected: boolean, explore: boolean) {
  return explore && map.getZoom() < PIN_ZOOM ? bubbleIcon(L, 1, selected) : pinIcon(L, v, selected);
}

/** Counted bubble: the same look for clusters and for lone venues at city zoom. Size scales mildly with count. */
function bubbleIcon(L: any, n: number, selected = false) {
  const size = Math.round(30 + Math.min(18, Math.sqrt(n) * 4));
  return L.divIcon({
    html: `<div class="hp-cluster${n >= 10 ? " hp-cluster-big" : ""}${selected ? " hp-cluster-selected" : ""}">${n}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
}

function pinIcon(L: any, v: Venue, selected: boolean) {
  const n = v.events.length;
  const size = selected ? 30 : 24;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
    html: `<div class="hp-pin${selected ? " hp-pin-selected" : ""}" style="--c:${CATEGORY_COLORS[v.category]}">${n > 1 ? `<span class="hp-pin-count">${n}</span>` : ""}</div>`,
  });
}
