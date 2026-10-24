"use client";

import { useEffect, useState } from "react";
import { distanceLabel } from "./format";

/** "· a 12 min caminando" when the site already has location permission; otherwise renders nothing. */
export function WalkingHint({ lat, lng }: { lat?: number; lng?: number }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (lat == null || lng == null || !("permissions" in navigator) || !("geolocation" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => setLabel(distanceLabel({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat, lng })),
          () => {},
          { timeout: 8000, maximumAge: 300_000 },
        );
      })
      .catch(() => {});
  }, [lat, lng]);
  if (!label) return null;
  return <span className="text-tertiary"> · {label}</span>;
}
