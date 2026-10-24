/**
 * Nightclubs from data/boliches.json: concrete upcoming events per venue, found by
 * searching Alpogo (live search by venue name) and the saved Venti API dump
 * (data/private/html/venti/api-<n>.json) for the venue's name. Venues with no
 * concrete event emit nothing. The list has no websites or Instagram handles, so those
 * surfaces are not queried; Passline is a Cloudflare challenge in every saved page.
 */
import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, fetchText, parseSpanishDate, toIso, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean, stripAccents } from "./lib.mjs";
import { savedPages } from "./saved.mjs";

const VENUES = JSON.parse(readFileSync(join(ROOT, "data", "boliches.json"), "utf8")).venues;
const norm = (s) => stripAccents(clean(s).toLowerCase()).replace(/\b(night ?club|club|boliche|bar|disco)\b/g, "").replace(/\s+/g, " ").trim();
const sameVenue = (a, b) => { const x = norm(a), y = norm(b); return x.length > 2 && y.length > 2 && (x === y || x.startsWith(y + " ") || y.startsWith(x + " ")); };

function utcToRosario(iso) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

/** Saved Venti API events whose venue name matches. */
function ventiFor(venue, pages, now) {
  const out = [];
  for (const p of pages) {
    let list = [];
    try { list = JSON.parse(p.text)?.events ?? []; } catch { continue; }
    for (const e of list) {
      const place = e.venue?.placeName || e.placeName || "";
      if (!sameVenue(place, venue.name) || !e.startDate) continue;
      const startsAt = utcToRosario(e.startDate);
      if (!inWindow(startsAt, now)) continue;
      out.push({ title: e.name, startsAt, address: clean(e.venue?.readableAddress) || undefined, lat: Number(e.venue?.latitude), lng: Number(e.venue?.longitude), sourceName: "Venti", sourceUrl: `https://venti.live/evento/${e.urlName}`, imageUrl: e.bannerImg || e.promoImg });
    }
  }
  return out;
}

/** Alpogo live search by venue name; keeps cards whose place matches the venue. */
async function alpogoFor(venue, now) {
  const out = [];
  const $ = cheerio.load(await fetchText(`https://alpogo.com/buscar?busqueda=${encodeURIComponent(venue.name)}`, { headers: { Accept: "text/html" } }));
  for (const card of $(".evento").toArray()) {
    const c = $(card);
    const place = clean(c.find(".lugar-link").first().text());
    if (!/rosario/i.test(place) || !sameVenue(place.replace(/,.*$/, ""), venue.name)) continue;
    const startsAt = parseSpanishDate(clean(c.find("p.fecha").first().text()), now);
    if (!startsAt || !inWindow(startsAt, now)) continue;
    const price = clean(c.find(".btn-comprar").first().text()).match(/\$\s?([\d.]+)/);
    out.push({
      title: clean(c.find(".nombre-artista").first().text()), startsAt,
      price: price ? { free: false, min: Number(price[1].replace(/\./g, "")), currency: "ARS" } : undefined,
      sourceName: "Alpogo", sourceUrl: c.find('a[href*="/evento/"]').first().attr("href"), imageUrl: c.find("img").first().attr("src"),
    });
  }
  return out;
}

export async function run(now = new Date()) {
  const ventiPages = (savedPages("venti") ?? []).filter((p) => p.file.endsWith(".json"));
  const events = [];
  const perVenue = {};
  for (const venue of VENUES) {
    let found = ventiFor(venue, ventiPages, now);
    try { found = found.concat(await alpogoFor(venue, now)); } catch (e) { console.warn(`  boliches: alpogo search failed for ${venue.name}: ${e.message}`); }
    for (const f of found) {
      const ev = normalizeEvent({
        ...f,
        venueName: venue.name,
        address: venue.address ?? f.address ?? undefined, // the list has gaps; the ticketing source often knows the street
        category: guessCategory(`${f.title} ${venue.music ?? ""}`, "fiesta"),
        sourceType: "ticketing",
      });
      if (ev) events.push(ev);
    }
    perVenue[venue.name] = found.length;
  }
  console.log("boliches per venue:", JSON.stringify(Object.fromEntries(Object.entries(perVenue).filter(([, n]) => n > 0))));
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("boliches", await run());
}
