"use client";

/**
 * Loads MapLibre GL JS 4.x from cdnjs on the client, once. Never runs on the server:
 * only call it from inside a useEffect.
 */
export const MAPLIBRE_VERSION = "4.7.1";
export const MAPLIBRE_BASE = `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSION}`;

/** Free dark vector basemap (OpenStreetMap data, CARTO tiles, no key). */
export const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Minimal typing for what we use; MapLibre ships no types without the npm package.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type MapLibre = any;
export type GLMap = any;
export type GLPopup = any;

declare global {
  interface Window {
    maplibregl?: MapLibre;
  }
}

let promise: Promise<MapLibre> | null = null;

export function loadMapLibre(): Promise<MapLibre> {
  if (typeof window === "undefined") return Promise.reject(new Error("MapLibre only loads in the browser"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (promise) return promise;
  promise = Promise.all([loadCss(`${MAPLIBRE_BASE}/maplibre-gl.min.css`, "maplibre"), loadScript(`${MAPLIBRE_BASE}/maplibre-gl.min.js`)])
    .then(() => {
      if (!window.maplibregl) throw new Error("El mapa no cargó");
      return window.maplibregl;
    })
    .catch((e) => {
      promise = null;
      throw e instanceof Error ? e : new Error("No se pudo cargar el mapa");
    });
  return promise;
}

/** The stylesheet must be applied before the map is created, or controls and the canvas are laid out wrong. */
function loadCss(href: string, key: string): Promise<void> {
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

function loadScript(src: string): Promise<void> {
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
