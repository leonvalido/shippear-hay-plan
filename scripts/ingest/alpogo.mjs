/**
 * Alpogo (ticketing): the site search for "Rosario" returns event cards with
 * title, "Sábado 07/11, 16:30 hs", venue ("Teatro Nuevo Monumental, Rosario"),
 * image, "Comprar desde $25000" and the event link. Venues are geocoded by name
 * (no address on the cards; venue pages are 404 for anonymous visitors).
 */
import * as cheerio from "cheerio";
import { fetchText, geocode, parseSpanishDate, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";

const SEARCH_URLS = [
  "https://alpogo.com/buscar?busqueda=Rosario",
  "https://alpogo.com/buscar?busqueda=Rosario&provincia_id=21",
];

export async function run(now = new Date()) {
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
