/**
 * Press: Rosario3's weekly "Qué hacemos este fin de semana en Rosario" article.
 * Every item is one paragraph with a fixed shape:
 *   "**Este sábado a las 21, se presentará **Título**, descripción. En el Teatro X (Calle 123). Entrada gratuita."
 * Day words are resolved against the article date (YYYYMMDD in its URL), venues are
 * geocoded by address (Georef, then Nominatim, cached). Only rule-based parsing, no AI.
 * Articles are discovered from the home and the Ocio section; SEED_URLS are a fallback.
 */
import * as cheerio from "cheerio";
import { fetchText, geocode, parseTime, toIso, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean, stripAccents, townOf } from "./lib.mjs";

const HOME = "https://www.rosario3.com/";
const LIST_PAGES = [HOME, "https://www.rosario3.com/seccion/ocio/", "https://www.rosario3.com/seccion/ocio/pagina2.html"];
const AGENDA_RE = /\/ocio\/que-hace(?:mos|r)-[^"]*fin-de-semana[^"]*-(\d{8})-\d{4}\.html/;
const SEED_URLS = [
  "https://www.rosario3.com/ocio/que-hacemos-este-fin-de-semana-en-rosario-festival-bandera-ricardo-darin-angela-torres-los-nocheros-y-mas-20261023-0001.html",
];
const DAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** The date for "este sábado" relative to the article's publication date. */
function dayToDate(pubYmd, dayWord) {
  const y = Number(pubYmd.slice(0, 4)), m = Number(pubYmd.slice(4, 6)), d = Number(pubYmd.slice(6, 8));
  const pub = new Date(Date.UTC(y, m - 1, d));
  const delta = (DAYS[stripAccents(dayWord)] - pub.getUTCDay() + 7) % 7;
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Venue and address from the last "En el Teatro Astengo (Mitre 754)." style clause. */
function venueFrom(plain) {
  const re = /\b[Ee]n (?:el |la |los |las )?([A-ZÁÉÍÓÚ0-9][^(,;]{2,70}?)(?:\s*\(([^)]{3,80})\))?(?=\.(?:\s|$)|[,;]|$)/g;
  const all = [...plain.matchAll(re)].filter((m) => !/^(vivo|el marco|marco)/i.test(m[1]));
  let m = all.at(-1);
  if (!m) m = plain.match(/\b(?:cine|teatro|museo|sala|club|bar|centro cultural) ([A-ZÁÉÍÓÚ][\wáéíóúñÁÉÍÓÚ]+(?: [A-ZÁÉÍÓÚ][\wáéíóúñ]+)*)/);
  if (!m) return null;
  const venue = clean(m[1]).replace(/^(el|la|los|las)\s+/i, "");
  let address = clean(m[2] ?? "");
  if (!address && /\d/.test(venue) && /^(\d|avenida|av\.|bulevar|bv\.|pasaje|calle|[A-Z][a-záéíóú]+ \d)/.test(venue)) address = venue; // "En San Lorenzo 1329."
  return { venue, address: address || undefined };
}

const VERBS = /^(?:se |nos )?(?:realizar[aá]|presentar[aá]n?|proyectar[aá]|llegar[aá]|regresar[aá]|habr[aá]|comenzar[aá]|abrir[aá]|continuar[aá]|ofrecer[aá]n?|celebrar[aá]|recibir[aá]|volver[aá])\s+(?:(?:una|la|el|otra|nueva|nuevas|su|sus)\s+)*(?:(?:nueva|última|ultima|primera|segunda|tercera|cuarta|quinta|sexta|séptima|octava)\s+)?(?:(?:función|funciones|jornada|edición|edicion|proyección)\s+(?:de|del)\s+)?/i;

export function parseParagraph(text, pubYmd) {
  const plain = clean(text.replace(/\*\*/g, ""));
  const lead = stripAccents(plain.toLowerCase()).match(/^este (viernes|sabado|domingo|lunes|martes|miercoles|jueves)\b/);
  if (!lead) return null;
  const date = dayToDate(pubYmd, lead[1]);
  const timeText = plain.match(/^[^,]*?(?:a las|desde las|de)\s+(\d{1,2}(?:[.:]\d{2})?)/i);
  const time = (timeText && parseTime(`${timeText[1]} hs`)) ?? { h: 0, min: 0 };
  const bolds = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => clean(m[1])).filter((s) => s.length > 2);
  const others = bolds.filter((s) => !/^e?ste /i.test(s) && !/^(?:de |con |un |una )/i.test(s));
  let title = others[0];
  if (!title) {
    title = plain.replace(/^[^,]*,\s*/, "").replace(VERBS, "");
    title = title.split(/\s+en (?:el|la|los|las)\s+[A-ZÁÉÍÓÚ]|\s+en [A-ZÁÉÍÓÚ]|[.,(]/)[0];
  }
  title = clean(title.replace(/[,:;]+$/, ""));
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length < 3) return null;
  const place = venueFrom(plain);
  if (!place) return null;
  const free = /gratuit|gratis|a la gorra|entrada libre|sin costo/i.test(plain);
  return {
    title,
    description: plain,
    startsAt: toIso(date.y, date.m, date.d, time.h, time.min),
    venueName: place.venue,
    address: place.address,
    category: guessCategory(`${title} ${plain}`),
    price: free ? { free: true, currency: "ARS" } : undefined,
  };
}

async function discoverArticles() {
  const found = new Map();
  for (const url of LIST_PAGES) {
    try {
      for (const m of (await fetchText(url, { headers: { Accept: "text/html" } })).matchAll(new RegExp(AGENDA_RE.source, "g"))) {
        found.set(new URL(m[0], HOME).toString(), m[1]);
      }
    } catch (e) {
      console.warn(`  press: listing failed ${url}: ${e.message}`);
    }
  }
  for (const u of SEED_URLS) if (!found.has(u)) found.set(u, u.match(AGENDA_RE)?.[1]);
  return found;
}

export async function run(now = new Date()) {
  const articles = await discoverArticles();
  const events = [];
  for (const [url, pubYmd] of articles) {
    if (!pubYmd) continue;
    let html;
    try { html = await fetchText(url, { headers: { Accept: "text/html" } }); } catch (e) { console.warn(`  press: article failed ${url}: ${e.message}`); continue; }
    const $ = cheerio.load(html);
    const image = $('meta[property="og:image"]').attr("content");
    let count = 0;
    for (const p of $("p").toArray()) {
      const inner = $(p).html() ?? "";
      const text = cheerio.load(inner.replace(/<\/?(strong|b)(?:\s[^>]*)?>/g, "**"), null, false).text();
      const parsed = parseParagraph(text, pubYmd);
      if (!parsed || !inWindow(parsed.startsAt, now)) continue;
      const town = townOf(parsed.description); // items in Funes, San Lorenzo, etc. geocode in their own town
      const geo = await geocode(parsed.venueName, parsed.address, town);
      const ev = normalizeEvent({
        ...parsed,
        address: town !== "Rosario" ? `${parsed.address ?? parsed.venueName}, ${town}` : parsed.address,
        lat: geo?.lat, lng: geo?.lng,
        sourceType: "press",
        sourceName: "Rosario3",
        sourceUrl: url,
        imageUrl: image,
      });
      if (ev) { events.push(ev); count++; }
    }
    console.log(`press: ${count} items from ${url.slice(0, 80)}…`);
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("press", await run());
}
