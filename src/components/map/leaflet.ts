"use client";

/**
 * Loads Leaflet 1.9.4 from cdnjs on the client, once. Never runs on the server:
 * only call it from inside a useEffect.
 */
const VERSION = "1.9.4";
const BASE = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/${VERSION}`;

// Minimal typing for what we use; Leaflet ships no types without the npm package.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type LeafletMap = any;
export type LeafletMarker = any;
export type Leaflet = any;

declare global {
  interface Window {
    L?: Leaflet;
  }
}

let promise: Promise<Leaflet> | null = null;

export function loadLeaflet(): Promise<Leaflet> {
  if (typeof window === "undefined") return Promise.reject(new Error("Leaflet only loads in the browser"));
  if (window.L) return Promise.resolve(window.L);
  if (promise) return promise;

  promise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${BASE}/leaflet.min.css`;
      link.crossOrigin = "";
      link.setAttribute("data-leaflet", "");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = `${BASE}/leaflet.min.js`;
    script.async = true;
    script.crossOrigin = "";
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet no cargó")));
    script.onerror = () => {
      promise = null;
      reject(new Error("No se pudo cargar el mapa"));
    };
    document.head.appendChild(script);
  });
  return promise;
}
