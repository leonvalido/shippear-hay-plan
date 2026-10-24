import { ROSARIO_BBOX } from "./schema";
import { normalizeText } from "./normalize";

/**
 * Geocoding through Georef (apis.datos.gob.ar), the official Argentine normaliser.
 * It resolves street addresses ("Laprida 1223"), not venue names.
 * The cache is a plain object the caller persists (scripts/build-events.ts
 * keeps it in data/private/geocache.json).
 */

const GEOREF = "https://apis.datos.gob.ar/georef/api/direcciones";
const TIMEOUT_MS = 8000;

export type LatLng = { lat: number; lng: number };
export type GeoCache = Record<string, LatLng | null>;

export function inRosario(p: LatLng): boolean {
  return p.lng >= ROSARIO_BBOX.minLng && p.lng <= ROSARIO_BBOX.maxLng && p.lat >= ROSARIO_BBOX.minLat && p.lat <= ROSARIO_BBOX.maxLat;
}

/** Strip ", Rosario" / ", Santa Fe" suffixes so the cache key and the query stay short. */
export function cleanAddress(address: string): string {
  return address
    .replace(/,?\s*(rosario|santa fe|argentina)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[,\s]+$/, "")
    .trim();
}

/** Looks like "Street 123" (Georef needs a house number). */
export function hasStreetNumber(address: string): boolean {
  return /\d{2,}/.test(address);
}

type GeorefResponse = { direcciones?: { ubicacion?: { lat: number | null; lon: number | null } }[] };

export async function geocodeAddress(address: string, cache: GeoCache = {}, fetchImpl: typeof fetch = fetch): Promise<LatLng | undefined> {
  const clean = cleanAddress(address);
  if (!hasStreetNumber(clean)) return undefined;
  const key = normalizeText(clean);
  if (key in cache) return cache[key] ?? undefined;

  const url = new URL(GEOREF);
  url.searchParams.set("direccion", clean);
  url.searchParams.set("localidad", "Rosario");
  url.searchParams.set("provincia", "Santa Fe");
  url.searchParams.set("max", "1");

  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return undefined; // not cached: may be transient
    const data = (await res.json()) as GeorefResponse;
    const u = data.direcciones?.[0]?.ubicacion;
    const point = u && u.lat !== null && u.lon !== null ? { lat: u.lat, lng: u.lon } : null;
    cache[key] = point && inRosario(point) ? point : null;
    return cache[key] ?? undefined;
  } catch {
    return undefined;
  }
}
