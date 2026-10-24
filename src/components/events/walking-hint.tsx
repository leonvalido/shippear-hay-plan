"use client";

import { useEffect, useState } from "react";
import { haversineMeters } from "./format";

/** "a 12 min caminando" or, when it is not walkable, "a 25 min en auto". Only when location permission is already granted. */
export function WalkingHint({ lat, lng, className }: { lat?: number; lng?: number; className?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (lat == null || lng == null || !("permissions" in navigator) || !("geolocation" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const m = haversineMeters({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat, lng });
            const walk = Math.max(1, Math.round(m / 80));
            if (walk < 60) setLabel(`a ${walk} min caminando`);
            else setLabel(`a ${Math.max(5, Math.round((m / 1000) * 2.2))} min en auto`);
          },
          () => {},
          { timeout: 8000, maximumAge: 300_000 },
        );
      })
      .catch(() => {});
  }, [lat, lng]);
  if (!label) return null;
  return <span className={className}>{label}</span>;
}
