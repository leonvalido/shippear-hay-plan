/**
 * Venti (ticketing, mostly electronic music and big shows). The site blocks plain
 * fetches, so this reads the pages the coordinator saved: api-<n>.json (the public
 * events API, with venue coordinates) and evento pages (JSON-LD with prices).
 */
import { toIso, inWindow, inRosario, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";
import { savedPages, jsonLdEvents } from "./saved.mjs";

/** "2026-10-24T21:00:00.000Z" → local Rosario ISO */
function utcToRosario(iso) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

export async function run(now = new Date()) {
  const pages = savedPages("venti");
  if (!pages) { console.warn("venti: no saved pages (data/private/html/venti missing); skipping"); return []; }

  // prices and descriptions from the event pages, keyed by url slug
  const details = new Map();
  for (const p of pages.filter((p) => p.file.endsWith(".html"))) {
    for (const ld of jsonLdEvents(p.text)) details.set(p.url.split("/").pop(), ld);
  }

  const events = [];
  for (const p of pages.filter((p) => p.file.endsWith(".json"))) {
    let list = [];
    try { list = JSON.parse(p.text)?.events ?? []; } catch { continue; }
    for (const e of list) {
      const v = e.venue ?? {};
      const lat = Number(v.latitude), lng = Number(v.longitude);
      if (!(inRosario(lat, lng) || /rosario/i.test(`${v.readableAddress ?? ""} ${v.city?.name ?? ""}`))) continue;
      if (!e.startDate) continue;
      const startsAt = utcToRosario(e.startDate);
      if (!inWindow(startsAt, now)) continue;
      const ld = details.get(e.urlName);
      const offers = [].concat(ld?.offers ?? []).filter((o) => !o.priceCurrency || o.priceCurrency === "ARS");
      const prices = offers.flatMap((o) => [o.price, o.lowPrice, o.highPrice]).map(Number).filter((n) => Number.isFinite(n));
      const ev = normalizeEvent({
        title: e.name,
        description: ld?.description,
        startsAt,
        endsAt: ld?.endDate ? utcToRosario(ld.endDate) : undefined,
        venueName: clean(v.placeName || e.placeName) || "Rosario",
        address: clean(v.readableAddress) || undefined,
        lat, lng,
        category: guessCategory(`${e.name} ${v.placeName ?? ""}`, "fiesta"),
        price: prices.length ? { free: Math.max(...prices) === 0, min: Math.min(...prices), max: Math.max(...prices), currency: "ARS" } : undefined,
        sourceType: "ticketing",
        sourceName: "Venti",
        sourceUrl: `https://venti.live/evento/${e.urlName}`,
        imageUrl: e.bannerImg || e.promoImg || ld?.image,
      });
      if (ev) events.push(ev);
    }
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("venti", await run());
}
