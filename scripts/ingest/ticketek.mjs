/**
 * Ticketek Argentina (ticketing: theatre, big concerts). The Angular site is empty for
 * plain fetches, so this reads the show pages the coordinator saved (search filtered by
 * city = Rosario, then one page per show). Each show page carries a JSON-LD array with one
 * MusicEvent per function: date-time, venue, street address and the "desde" price.
 */
import { geocode, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";
import { savedPages, jsonLdEvents } from "./saved.mjs";

export async function run(now = new Date()) {
  const pages = savedPages("ticketek");
  if (!pages) { console.warn("ticketek: no saved pages (data/private/html/ticketek missing); skipping"); return []; }

  const events = [];
  for (const p of pages) {
    const lds = jsonLdEvents(p.text);
    if (lds.length === 0 || !/Rosario/.test(p.text)) continue;
    const text = p.text.replace(/<[^>]+>/g, " ");
    const family = /Familia en Ticketek|Infantil/i.test(text) && /familia/i.test(p.url);
    for (const ld of lds) {
      if (!ld.startDate || !inWindow(ld.startDate, now)) continue;
      const venueName = clean(ld.location?.name) || "Rosario";
      const address = clean(ld.location?.address?.streetAddress) || undefined;
      const geo = await geocode(venueName, address);
      const price = Number(ld.offers?.price);
      const ev = normalizeEvent({
        title: ld.name,
        description: clean(ld.description) || undefined,
        startsAt: ld.startDate,
        endsAt: ld.endDate && ld.endDate !== ld.startDate ? ld.endDate : undefined,
        venueName,
        address,
        lat: geo?.lat, lng: geo?.lng,
        category: guessCategory(`${ld.name} ${venueName} ${ld.description ?? ""}`, family ? "infantil" : "teatro"),
        price: Number.isFinite(price) ? { free: price === 0, min: price, currency: "ARS" } : undefined,
        sourceType: "ticketing",
        sourceName: "Ticketek",
        sourceUrl: ld.offers?.url || p.url,
        imageUrl: ld.image,
      });
      if (ev) events.push(ev);
    }
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("ticketek", await run());
}
