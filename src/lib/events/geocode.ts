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

/**
 * Coarse zone of Rosario from coordinates, used when a source gives no barrio.
 * Boxes are approximate on purpose: they feed a count strip, not an address.
 */
export function barrioFromCoords(lat: number, lng: number): string {
  // Nearby towns first (Gran Rosario), then Rosario's zones.
  if (lat < -33.05 && lng > -60.6) return "Arroyo Seco";
  if (lat < -33.0 && lng > -60.68) return "Villa G. Gálvez";
  if (lat < -32.99 && lng < -60.72) return "Pérez";
  if (lng < -60.84) return lat > -32.93 ? "Roldán" : "Funes";
  if (lng < -60.77 && lat > -32.95) return "Funes";
  if (lat > -32.74) return "San Lorenzo";
  if (lat > -32.8) return "Capitán Bermúdez";
  if (lat > -32.86 && lng > -60.75) return "Granadero Baigorria";
  if (lat > -32.905) return "Norte";
  if (lat < -32.985) return "Sur";
  if (lng < -60.695) return "Oeste";
  if (lat >= -32.94 && lat <= -32.905 && lng >= -60.66 && lng <= -60.625) return "Pichincha";
  if (lat >= -32.955 && lat <= -32.935 && lng >= -60.655 && lng <= -60.62) return "Centro";
  if (lat >= -32.975 && lat <= -32.945 && lng >= -60.68 && lng <= -60.64) return "Parque";
  if (lng > -60.625) return "Costanera";
  return "Macrocentro";
}

/**
 * Venue-name lookup through Nominatim (OpenStreetMap), bounded to Gran Rosario,
 * for sources that give a venue but no street number. Cached like addresses.
 * Nominatim policy: at most one request per second and a real User-Agent.
 */
export async function geocodeVenue(
  venueName: string,
  cache: GeoCache = {},
  fetchImpl: typeof fetch = fetch,
): Promise<LatLng | undefined> {
  const name = venueName.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (name.length < 3) return undefined;
  const key = "venue:" + normalizeText(name);
  if (key in cache) return cache[key] ?? undefined;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${name}, Rosario, Santa Fe, Argentina`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("viewbox", `${ROSARIO_BBOX.minLng},${ROSARIO_BBOX.maxLat},${ROSARIO_BBOX.maxLng},${ROSARIO_BBOX.minLat}`);
  url.searchParams.set("bounded", "1");
  try {
    await new Promise((r) => setTimeout(r, 1100));
    const res = await fetchImpl(url, { headers: { "User-Agent": "HayPlan hackathon (contact: leon.valido@hotmail.com)" } });
    if (!res.ok) return undefined;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = data[0];
    const point = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : undefined;
    cache[key] = point && inRosario(point) ? point : null;
    return cache[key] ?? undefined;
  } catch {
    return undefined;
  }
}
