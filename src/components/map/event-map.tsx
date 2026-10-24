"use client";

import { useEffect, useRef, useState } from "react";
import type { Event } from "@/lib/events/schema";
import { ROSARIO_CENTER } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, formatPrice, formatTime, relativeDayLabel } from "@/components/events/format";
import { loadLeaflet, loadMarkerCluster, type LeafletMap, type LeafletMarker } from "./leaflet";

type Props = {
  events: Event[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Fit the view to the pins when they change. */
  fit?: boolean;
  /** Show a "my location" button and a popup with a link on each pin. */
  explore?: boolean;
  /** Called with the viewer's position after the location button succeeds. */
  onLocate?: (pos: { lat: number; lng: number }) => void;
  interactive?: boolean;
  className?: string;
};

// OSM tiles, darkened with a CSS filter in dark mode (CARTO basemaps now require an API key).
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Leaflet map with one colored pin per geolocated event. Client-only. */
export function EventMap({ events, selectedId, onSelect, center = ROSARIO_CENTER, zoom = 13, fit = false, explore = false, onLocate, interactive = true, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  /** Cluster group when the plugin loaded; otherwise pins go straight on the map. */
  const layerRef = useRef<LeafletMarker>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [retry, setRetry] = useState(0);
  const onWindowResize = () => mapRef.current?.invalidateSize();
  const meRef = useRef<LeafletMarker>(null);
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;

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
        map.flyTo(ll, Math.max(map.getZoom(), 14));
        onLocateRef.current?.({ lat: ll[0], lng: ll[1] });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        if (containerRef.current.clientHeight === 0) {
          // Container not laid out yet (e.g. hidden tab): retry on next frame instead of initializing at 0px.
          requestAnimationFrame(() => setRetry((n) => n + 1));
          return;
        }
        const map = L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom,
          preferCanvas: true,
          // Animations are what left the tile layer half-rendered on phones (tiles stuck mid zoom transition).
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
            layerRef.current = L.markerClusterGroup({
              maxClusterRadius: 44,
              showCoverageOnHover: false,
              spiderfyOnMaxZoom: true,
              zoomToBoundsOnClick: true,
              iconCreateFunction: (cluster: { getChildCount: () => number }) => {
                const n = cluster.getChildCount();
                const size = n < 10 ? 36 : n < 100 ? 42 : 48;
                return L.divIcon({
                  html: `<div class="hp-cluster${n >= 10 ? " hp-cluster-big" : ""}">${n}</div>`,
                  className: "",
                  iconSize: [size, size],
                });
              },
            }).addTo(map);
          }
          setReady(true);
        };
        if (explore) loadMarkerCluster().then(start, start);
        else start();
        // Layout settles after fonts, sheet and flex sizing: nudge Leaflet a couple of times.
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

  // Sync pins.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!ready || !map || !L) return;
    const markers = markersRef.current;
    const seen = new Set<string>();
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      seen.add(e.id);
      let m = markers.get(e.id);
      if (!m) {
        m = L.circleMarker([e.lat, e.lng], pinStyle(e, false));
        m.bindTooltip(`${formatTime(e.startsAt)} · ${e.title}`, { direction: "top", offset: [0, -8] });
        if (explore) m.bindPopup(popupHtml(e), { offset: [0, -6], closeButton: false, maxWidth: 240 });
        m.on("click", () => onSelectRef.current?.(e.id));
        (layerRef.current ?? map).addLayer(m);
        markers.set(e.id, m);
      } else {
        m.setLatLng([e.lat, e.lng]);
      }
    }
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        (layerRef.current ?? map).removeLayer(m);
        markers.delete(id);
      }
    }
    if (fit && seen.size > 0) {
      const group = L.featureGroup([...markers.values()]);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15, animate: false });
      setTimeout(() => map.invalidateSize({ pan: false }), 350);
    }
  }, [events, ready, fit, explore]);

  // Highlight the selected pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const e of events) {
      const m = markersRef.current.get(e.id);
      if (!m) continue;
      const sel = e.id === selectedId;
      m.setStyle(pinStyle(e, sel));
      if (sel) {
        if (layerRef.current?.zoomToShowLayer) {
          // Pull the pin out of its cluster first, then center on it.
          layerRef.current.zoomToShowLayer(m, () => {
            m.bringToFront();
            map.panTo(m.getLatLng(), { animate: false });
          });
        } else {
          m.bringToFront();
          map.panTo(m.getLatLng(), { animate: false });
        }
      }
    }
  }, [selectedId, events, ready]);

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
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function popupHtml(e: Event) {
  return `<div style="font:13px/1.35 system-ui,sans-serif;min-width:160px">
    <strong style="display:block;margin-bottom:2px">${escapeHtml(e.title)}</strong>
    <span style="opacity:.7">${escapeHtml(relativeDayLabel(e.startsAt))}, ${formatTime(e.startsAt)} · ${escapeHtml(e.venueName)}</span><br/>
    <span style="opacity:.7">${escapeHtml(formatPrice(e.price))}</span><br/>
    <a href="/evento/${encodeURIComponent(e.id)}" style="display:inline-block;margin-top:6px;font-weight:600;color:${CATEGORY_COLORS[e.category]}">Ver evento →</a>
  </div>`;
}

function pinStyle(e: Event, selected: boolean) {
  const color = CATEGORY_COLORS[e.category];
  return {
    radius: selected ? 11 : 8,
    color: selected ? "#111" : "#fff",
    weight: selected ? 3 : 2,
    fillColor: color,
    fillOpacity: 0.95,
  };
}
