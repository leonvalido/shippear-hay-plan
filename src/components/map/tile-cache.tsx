"use client";

import { useEffect } from "react";

/** Registers the tile-caching service worker (no-op where unsupported or on insecure origins). */
export function TileCache() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
