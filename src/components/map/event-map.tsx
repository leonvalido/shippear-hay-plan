"use client";

import { useEffect, useRef, useState } from "react";
import type { Event } from "@/lib/events/schema";
import { ROSARIO_CENTER } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, formatTime } from "@/components/events/format";
import { loadLeaflet, type LeafletMap, type LeafletMarker } from "./leaflet";

type Props = {
  events: Event[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Fit the view to the pins when they change. */
  fit?: boolean;
  interactive?: boolean;
  className?: string;
};

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Leaflet map with one colored pin per geolocated event. Client-only. */
export function EventMap({ events, selectedId, onSelect, center = ROSARIO_CENTER, zoom = 13, fit = false, interactive = true, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom,
          zoomControl: interactive,
          dragging: interactive,
          scrollWheelZoom: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
          keyboard: interactive,
          tap: interactive,
        });
        L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map);
        mapRef.current = map;
        setReady(true);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        m.on("click", () => onSelectRef.current?.(e.id));
        m.addTo(map);
        markers.set(e.id, m);
      } else {
        m.setLatLng([e.lat, e.lng]);
      }
    }
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        m.remove();
        markers.delete(id);
      }
    }
    if (fit && seen.size > 0) {
      const group = L.featureGroup([...markers.values()]);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15 });
    }
  }, [events, ready, fit]);

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
        m.bringToFront();
        map.panTo(m.getLatLng(), { animate: true });
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
      <div ref={containerRef} className="h-full w-full" role="application" aria-label="Mapa de eventos" />
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
