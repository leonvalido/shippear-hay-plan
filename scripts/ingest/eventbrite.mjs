/**
 * Eventbrite Rosario city page: each listing page embeds a schema.org ItemList
 * (name, date, venue, coordinates, image) in window.__SERVER_DATA__. The exact
 * start time, description and price come from the event page's JSON-LD.
 */
import * as cheerio from "cheerio";
import { fetchText, geocode, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";

const LIST = "https://www.eventbrite.com.ar/d/argentina--rosario/events/";
const MAX_PAGES = 3;
const MAX_DETAILS = 60;

function serverData(html) {
  const m = html.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});\s*\n/);
  return m ? JSON.parse(m[1]) : null;
}

function eventLd(html) {
  const $ = cheerio.load(html);
  for (const s of $('script[type="application/ld+json"]').toArray()) {
    try {
      const j = JSON.parse($(s).html() ?? "");
      if (typeof j["@type"] === "string" && /Event$/.test(j["@type"])) return j;
    } catch { /* ignore */ }
  }
  return null;
}

export async function run(now = new Date()) {
  const listed = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = serverData(await fetchText(`${LIST}?page=${page}`));
    const items = data?.jsonld?.[0]?.itemListElement ?? [];
    if (items.length === 0) break;
    for (const { item } of items) {
      if (!item?.url || listed.has(item.url)) continue;
      if (!inWindow(`${item.startDate}T00:00:00-03:00`, now)) continue;
      listed.set(item.url, item);
    }
  }
  console.log(`eventbrite: ${listed.size} listed events in the window`);

  const events = [];
  let n = 0;
  for (const item of listed.values()) {
    if (n++ >= MAX_DETAILS) break;
    let ld = null;
    try { ld = eventLd(await fetchText(item.url)); } catch (e) { console.warn(`  eventbrite detail failed ${item.url}: ${e.message}`); }
    const online = /OnlineEventAttendanceMode/.test(`${ld?.eventAttendanceMode ?? item.eventAttendanceMode ?? ""}`) || /\bonline\b/i.test(item.name);
    if (online) continue;
    const loc = ld?.location ?? item.location ?? {};
    let geo = loc.geo ?? item.location?.geo;
    if (!geo && (loc.name || loc.address?.streetAddress)) {
      const g = await geocode(clean(loc.name), clean(loc.address?.streetAddress) || undefined);
      if (g) geo = { latitude: g.lat, longitude: g.lng };
    }
    const offers = [].concat(ld?.offers ?? []).filter((o) => !o.priceCurrency || o.priceCurrency === "ARS");
    const prices = offers.map((o) => Number(o.price ?? o.lowPrice)).filter((p) => Number.isFinite(p));
    const startsAt = ld?.startDate?.includes("T") ? ld.startDate : `${item.startDate}T00:00:00-03:00`;
    if (!inWindow(startsAt, now)) continue;
    const ev = normalizeEvent({
      title: ld?.name ?? item.name,
      description: ld?.description,
      startsAt,
      endsAt: ld?.endDate?.includes("T") ? ld.endDate : undefined,
      venueName: clean(loc.name) || clean(loc.address?.streetAddress) || "Rosario",
      address: clean(loc.address?.streetAddress) || undefined,
      lat: geo ? Number(geo.latitude) : undefined,
      lng: geo ? Number(geo.longitude) : undefined,
      category: guessCategory(`${item.name} ${clean(loc.name)} ${ld?.description ?? ""}`),
      price: prices.length ? { free: Math.max(...prices) === 0, min: Math.min(...prices), max: Math.max(...prices), currency: "ARS" }
        : /\b(gratis|free|gratuit)/i.test(`${item.name} ${ld?.description ?? ""}`) ? { free: true, currency: "ARS" } : undefined,
      sourceType: "platform",
      sourceName: "Eventbrite",
      sourceUrl: item.url,
      imageUrl: ld?.image ?? item.image,
    });
    if (ev) events.push(ev);
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("eventbrite", await run());
}
