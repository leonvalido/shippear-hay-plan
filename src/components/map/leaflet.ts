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

  promise = Promise.all([loadCss(`${BASE}/leaflet.min.css`, "leaflet"), loadScript(`${BASE}/leaflet.min.js`)])
    .then(() => {
      if (!window.L) throw new Error("Leaflet no cargó");
      return window.L;
    })
    .catch((e) => {
      promise = null;
      throw e instanceof Error ? e : new Error("No se pudo cargar el mapa");
    });
  return promise;
}

/** Stylesheet must be applied before the map is created, or tiles are laid out wrong (grey half map). */
export function loadCss(href: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-css="${key}"]`);
    if (existing) {
      if (existing.dataset.loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar el mapa")));
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "";
    link.dataset.css = key;
    link.onload = () => {
      link.dataset.loaded = "1";
      resolve();
    };
    link.onerror = () => reject(new Error("No se pudo cargar el mapa"));
    document.head.appendChild(link);
  });
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el mapa"));
    document.head.appendChild(script);
  });
}
