/**
 * Passline (ticketing). Every fetch, residential or not, has returned a Cloudflare
 * challenge so far. This reads whatever the coordinator saved and parses JSON-LD
 * events from any page that is a real listing; challenge pages are counted and skipped.
 */
import { geocode, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";
import { savedPages, jsonLdEvents } from "./saved.mjs";

export async function run(now = new Date()) {
  const pages = savedPages("passline");
  if (!pages) { console.warn("passline: no saved pages (data/private/html/passline missing); skipping"); return []; }
  const events = [];
  let challenges = 0;
  for (const p of pages) {
    if (/Just a moment|cf-challenge|challenge-platform/i.test(p.text)) { challenges++; continue; }
    for (const ld of jsonLdEvents(p.text)) {
      if (!ld.startDate || !inWindow(ld.startDate, now)) continue;
      const venueName = clean(ld.location?.name) || "Rosario";
      const address = clean(ld.location?.address?.streetAddress) || undefined;
      const geo = ld.location?.geo ?? (await geocode(venueName, address));
      const price = Number([].concat(ld.offers ?? [])[0]?.price);
      const ev = normalizeEvent({
        title: ld.name, description: clean(ld.description) || undefined, startsAt: ld.startDate, endsAt: ld.endDate,
        venueName, address,
        lat: Number(geo?.latitude ?? geo?.lat), lng: Number(geo?.longitude ?? geo?.lng),
        category: guessCategory(`${ld.name} ${venueName}`, "fiesta"),
        price: Number.isFinite(price) ? { free: price === 0, min: price, currency: "ARS" } : undefined,
        sourceType: "ticketing", sourceName: "Passline", sourceUrl: ld.url || p.url, imageUrl: ld.image,
      });
      if (ev) events.push(ev);
    }
  }
  if (challenges) console.warn(`passline: ${challenges} of ${pages.length} saved pages are bot challenges`);
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("passline", await run());
}
