"use client";

/**
 * Warms the basemap: fetches the vector tiles the user is likely to zoom through so they come from the
 * HTTP cache (30-day max-age) and the service worker instead of the network. Runs once per page, in the
 * background, after the first idle frame; stops when the map unmounts.
 */
type Box = [west: number, south: number, east: number, north: number];

/** Full maxBounds area at city zooms, then the venue area at pin zooms, then the dense core at 15. */
export function tilePlan(area: Box, venues: Box, core: Box): string[] {
  const out: string[] = [];
  for (const z of [10, 11, 12]) out.push(...tilesIn(area, z));
  for (const z of [13, 14]) out.push(...tilesIn(venues, z));
  out.push(...tilesIn(core, 15));
  return out;
}

function tilesIn([w, s, e, n]: Box, z: number): string[] {
  const [x0, y0] = tileXY(n, w, z);
  const [x1, y1] = tileXY(s, e, z);
  const out: string[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(`${z}/${x}/${y}`);
  return out;
}

function tileXY(lat: number, lng: number, z: number): [number, number] {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)];
}

/** The `{z}/{x}/{y}` template of the style's first vector source, or null (raster fallback style). */
export function tileTemplate(style: { sources?: Record<string, { type?: string; tiles?: string[] }> } | undefined): string | null {
  for (const src of Object.values(style?.sources ?? {})) {
    if (src.type === "vector" && src.tiles?.[0]) return src.tiles[0];
  }
  return null;
}

let started = false;

/** Fetches `tiles` (as `z/x/y`) through `template`, `parallel` at a time, lowest priority. Idempotent per page. */
export function warmTiles(template: string, tiles: string[], signal: AbortSignal, parallel = 6): Promise<void> {
  if (started) return Promise.resolve();
  started = true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || (conn?.effectiveType && /2g/.test(conn.effectiveType))) return Promise.resolve(); // skip only on data saver or 2g
  const queue = [...tiles];
  const worker = async () => {
    while (queue.length && !signal.aborted) {
      const t = queue.shift()!;
      const [z, x, y] = t.split("/");
      const url = template.replace("{z}", z).replace("{x}", x).replace("{y}", y);
      try {
        const res = await fetch(url, { mode: "cors", signal, priority: "low" } as RequestInit);
        await res.arrayBuffer(); // read fully so the browser stores it in the HTTP cache
      } catch {
        /* offline or aborted: the map still fetches on demand */
      }
    }
  };
  return Promise.all(Array.from({ length: parallel }, worker)).then(() => undefined);
}
