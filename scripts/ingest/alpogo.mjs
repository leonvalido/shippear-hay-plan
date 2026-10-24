/**
 * Alpogo (ticketing): the site search for "Rosario" returns event cards with
 * title, "Sábado 07/11, 16:30 hs", venue ("Teatro Nuevo Monumental, Rosario"),
 * image, "Comprar desde $25000" and the event link. Venues are geocoded by name
 * (no address on the cards; venue pages are 404 for anonymous visitors).
 * When the coordinator saved event pages under data/private/html/alpogo, those are
 * used instead: they carry the address, coordinates, exact time and description.
 */
import * as cheerio from "cheerio";
import { fetchText, geocode, parseSpanishDate, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";
import { savedPages } from "./saved.mjs";

const SEARCH_URLS = [
  "https://alpogo.com/buscar?busqueda=Rosario",
  "https://alpogo.com/buscar?busqueda=Rosario&provincia_id=21",
];

function fromSavedPage(p, now, cardDates) {
  const $ = cheerio.load(p.text);
  const title = clean($('meta[property="og:title"]').attr("content") ?? "").replace(/\s*\|\s*Alpogo\.com$/i, "");
  // multi-function events have no #fecha block; the search card still shows the next date
  const when = clean($("#fecha").text()) || cardDates.get(p.url) || "";
  const startsAt = parseSpanishDate(when, now);
  const place = $("#lugar .lugar-link");
  const placeText = clean(place.find(".nombre").text());
  if (!title || !startsAt || !/rosario/i.test(`${placeText} ${clean(place.text())}`)) return null;
  const lat = Number(p.text.match(/\blat\s*=\s*(-?\d+\.\d+)/)?.[1]);
  const lng = Number(p.text.match(/\blon(?:g)?\s*=\s*(-?\d+\.\d+)/)?.[1]);
  const price = clean($(".btn-compra-evento").text()).match(/\$\s?([\d.]+)/);
  const min = price ? Number(price[1].replace(/\./g, "")) : undefined;
  const end = when.match(/hasta\s+(\d{1,2}[:.]\d{2})/);
  return {
    title,
    description: clean($('meta[property="og:description"]').attr("content")) || undefined,
    startsAt,
    venueName: placeText.replace(/,\s*rosario.*$/i, "").replace(/\.$/, ""),
    address: clean(place.find("div span").last().text()) || undefined,
    lat, lng,
    category: guessCategory(`${title} ${placeText}`, "musica"),
    price: min != null ? { free: min === 0, min, currency: "ARS" } : undefined,
    sourceType: "ticketing",
    sourceName: "Alpogo",
    sourceUrl: p.url,
    imageUrl: $('meta[property="og:image"]').attr("content"),
    endsAtHint: end?.[1],
  };
}

export async function run(now = new Date()) {
  const saved = savedPages("alpogo");
  if (saved) {
    const events = [];
    const cardDates = new Map();
    for (const p of saved.filter((p) => /\/buscar/.test(p.url))) {
      const $ = cheerio.load(p.text);
      $(".evento").each((_, card) => {
        const link = $(card).find('a[href*="/evento/"]').first().attr("href");
        if (link) cardDates.set(link, clean($(card).find("p.fecha").first().text()));
      });
    }
    for (const p of saved.filter((p) => /\/evento\//.test(p.url))) {
      const c = fromSavedPage(p, now, cardDates);
      if (!c || !inWindow(c.startsAt, now)) continue;
      delete c.endsAtHint;
      const ev = normalizeEvent(c);
      if (ev) events.push(ev);
    }
    console.log(`alpogo: ${events.length} events from ${saved.length} saved pages`);
    return dedupe(events);
  }
  const seen = new Set();
  const events = [];
  for (const url of SEARCH_URLS) {
    const $ = cheerio.load(await fetchText(url, { headers: { Accept: "text/html" } }));
    for (const card of $(".evento").toArray()) {
      const c = $(card);
      const title = clean(c.find(".nombre-artista").first().text());
      const link = c.find('a[href*="/evento/"]').first().attr("href") ?? c.find('a[href*="/app/funciones/"]').first().attr("href");
      const placeText = clean(c.find(".lugar-link").first().text());
      if (!title || !link || seen.has(link) || !/rosario/i.test(placeText)) continue;
      seen.add(link);
      const startsAt = parseSpanishDate(clean(c.find("p.fecha").first().text()), now);
      if (!startsAt || !inWindow(startsAt, now)) continue;
      const venueName = placeText.replace(/,\s*rosario.*$/i, "").replace(/\.$/, "");
      const priceText = clean(c.find(".btn-comprar").first().text());
      const price = priceText.match(/\$\s?([\d.]+)/);
      const min = price ? Number(price[1].replace(/\./g, "")) : undefined;
      const geo = await geocode(venueName);
      const ev = normalizeEvent({
        title,
        startsAt,
        venueName,
        lat: geo?.lat, lng: geo?.lng,
        category: guessCategory(`${title} ${venueName}`, "musica"),
        price: min != null ? { free: min === 0, min, currency: "ARS" } : /gratis|free/i.test(priceText) ? { free: true, currency: "ARS" } : undefined,
        sourceType: "ticketing",
        sourceName: "Alpogo",
        sourceUrl: link,
        imageUrl: c.find("img").first().attr("src"),
      });
      if (ev) events.push(ev);
    }
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("alpogo", await run());
}
