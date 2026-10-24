/* HayPlan basemap cache: cache-first for vector tiles, sprite and glyphs, capped at 2000 entries, so revisits never refetch. */
const CACHE = "hayplan-tiles-v2";
const MAX = 2000;
const TILE_HOSTS = ["tiles.basemaps.cartocdn.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !TILE_HOSTS.some((h) => url.hostname.endsWith(h))) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) {
        cache.put(event.request, res.clone());
        trim(cache);
      }
      return res;
    }),
  );
});

let trimming = false;
async function trim(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - MAX; i++) await cache.delete(keys[i]);
  } finally {
    trimming = false;
  }
}
