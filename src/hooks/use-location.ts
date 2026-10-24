"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/components/events/format";

export type LocationStatus = "idle" | "locating" | "granted" | "denied";

export const LOCATION_DENIED = "No pudimos acceder a tu ubicación";

const OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 };

/**
 * "Cerca mío": the viewer's position, asked for on tap (a user gesture, so the browser shows its prompt).
 *
 *   const loc = useLocation();
 *   loc.active   — the chip is on; `loc.point` is set once the position arrived
 *   loc.status   — idle | locating | granted | denied
 *   loc.error    — Spanish message while a denial toast should show (clears itself)
 *   loc.toggle() — first tap asks and turns the filter on; a second tap turns it off
 *   loc.set(p)   — a position obtained elsewhere (the map's locate button)
 *
 * If the site already has permission, the point is picked up silently on mount so cards can show
 * walking minutes without a prompt; the filter still waits for a tap.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setError(null), 4000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("denied");
      setActive(false);
      showError(LOCATION_DENIED);
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
        setError(null);
      },
      () => {
        setStatus("denied");
        setActive(false);
        showError(LOCATION_DENIED);
      },
      OPTIONS,
    );
  }, [showError]);

  const toggle = useCallback(() => {
    if (active) {
      setActive(false);
      setError(null);
      return;
    }
    setActive(true);
    if (point) setStatus("granted");
    else request();
  }, [active, point, request]);

  /** A position obtained elsewhere (the map's own locate button): adopt it and turn the filter on. */
  const set = useCallback((p: LatLng) => {
    setPoint(p);
    setStatus("granted");
    setActive(true);
    setError(null);
  }, []);

  // Permission already granted to this site: pick the point up silently (no prompt, no filter).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator) || !("geolocation" in navigator)) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (cancelled || p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            setPoint((cur) => cur ?? { lat: pos.coords.latitude, lng: pos.coords.longitude });
            setStatus((s) => (s === "idle" ? "granted" : s));
          },
          () => {},
          { ...OPTIONS, maximumAge: 300_000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, point, active, error, toggle, set, locating: status === "locating" };
}
