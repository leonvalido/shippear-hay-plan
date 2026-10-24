/**
 * Luma: the public discover feed (api.lu.ma) has no Rosario place, so we page
 * through the Argentina feed and keep events whose address or coordinates are in Rosario.
 */
import { fetchJson, inWindow, inRosario, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";

const FEED = "https://api.lu.ma/discover/get-paginated-events?pagination_limit=100";
const MAX_PAGES = 5;

export async function run(now = new Date()) {
  const events = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchJson(cursor ? `${FEED}&pagination_cursor=${encodeURIComponent(cursor)}` : FEED);
    for (const entry of data.entries ?? []) {
      const e = entry.event ?? {};
      const geo = e.geo_address_info ?? {};
      const lat = Number(e.geo_latitude ?? geo.latitude), lng = Number(e.geo_longitude ?? geo.longitude);
      if (!(inRosario(lat, lng) || /rosario/i.test(`${geo.city_state ?? ""} ${geo.full_address ?? ""}`))) continue;
      const startsAt = new Date(new Date(e.start_at).getTime() - 3 * 3600_000).toISOString().replace("Z", "").replace(/\.\d{3}$/, "") + "-03:00";
      if (!inWindow(startsAt, now)) continue;
      const ev = normalizeEvent({
        title: e.name,
        startsAt,
        venueName: clean(geo.address ?? geo.full_address ?? "Rosario") || "Rosario",
        address: clean(geo.full_address) || undefined,
        lat, lng,
        category: guessCategory(e.name, "charla"),
        sourceType: "platform",
        sourceName: "Luma",
        sourceUrl: `https://lu.ma/${e.url}`,
        imageUrl: e.cover_url,
      });
      if (ev) events.push(ev);
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("luma", await run());
}
