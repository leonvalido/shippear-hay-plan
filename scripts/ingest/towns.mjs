/**
 * Towns around Rosario (Gran Rosario). None of the municipal sites publishes a dated
 * agenda: Funes has a news page, Granadero Baigorria a WordPress "eventos" type plus
 * news; San Lorenzo and Pérez only ordinances/static pages; Roldán and VGG are offline;
 * Capitán Bermúdez and Arroyo Seco are static. So this scans the two feeds that carry
 * text, keeps event-like posts that name an upcoming date inside the window, and
 * geocodes the venue in the right town (falling back to the town centre, flagged in address).
 */
import * as cheerio from "cheerio";
import { fetchText, fetchJson, geocode, parseSpanishDate, parseTime, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean, stripAccents } from "./lib.mjs";

const EVENT_WORDS = /\b(feria|festival|fiesta|show|recital|concierto|taller|cine|pel[ií]cula|picnic|encuentro|carnaval|muestra|obra|teatro|m[uú]sica|banda|dj|expo|maratón|maraton|carrera|torneo|jornada|peña|pena|sunset|charla|desfile|celebraci[oó]n|aniversario|inauguraci[oó]n)\b/i;
const SKIP_WORDS = /\b(vacunaci[oó]n|recolecci[oó]n|residuos|licitaci[oó]n|ordenanza|preinscripci[oó]n|inscripciones|convocatoria|operativo|pavimentaci[oó]n|tr[aá]mite)\b/i;

const TOWN_SOURCES = [
  {
    town: "Funes", center: { lat: -32.9167, lng: -60.8167 }, sourceName: "Municipalidad de Funes",
    async items() {
      const $ = cheerio.load(await fetchText("https://www.funes.gob.ar/noticias"));
      const links = [...new Set($('a[href^="/noticia/"]').map((_, a) => $(a).attr("href")).get())].slice(0, 12);
      const out = [];
      for (const href of links) {
        const url = `https://www.funes.gob.ar${href}`;
        const page = cheerio.load(await fetchText(url));
        const title = clean(page('meta[property="og:title"]').attr("content") || page("title").text()).replace(/\s*[|–-]\s*Gobierno de Funes$/i, "");
        const published = page.root().text().match(/\b(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/);
        out.push({ url, title, published: published ? new Date(`${published[2]} ${published[1]}, ${published[3]} 12:00:00Z`) : null, text: clean(page("section p, article p, .news-content p, p").map((_, p) => page(p).text()).get().join(" ")), image: page('meta[property="og:image"]').attr("content") });
      }
      return out;
    },
  },
  {
    town: "Granadero Baigorria", center: { lat: -32.8575, lng: -60.7117 }, sourceName: "Municipalidad de Granadero Baigorria",
    async items() {
      const out = [];
      for (const type of ["eventos", "posts"]) {
        const list = await fetchJson(`https://baigorria.gob.ar/wp-json/wp/v2/${type}?per_page=15&_fields=link,date,title,content,yoast_head_json`);
        for (const p of list) {
          const $ = cheerio.load(p.content?.rendered ?? "");
          out.push({ url: p.link, title: clean(cheerio.load(p.title?.rendered ?? "").text()), published: p.date ? new Date(`${p.date}-03:00`) : null, text: clean($.root().text()), image: p.yoast_head_json?.og_image?.[0]?.url });
        }
      }
      return out;
    },
  },
];

const MAX_POST_AGE_DAYS = 21;

/**
 * First upcoming date mentioned in the text. Relative days ("este viernes") are resolved
 * against the post's publish date, explicit dates against today; both must fall in the window.
 */
function upcomingDate(text, published, now) {
  const sentences = text.split(/(?<=[.!])\s+|\n/);
  for (const s of sentences) {
    const explicit = /\b\d{1,2}\s+de\s+[a-záé]+|\b\d{1,2}\/\d{1,2}\b/i.test(s);
    const relative = /\b(este|el|próximo|proximo)\s+(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i.test(s);
    if (!explicit && !relative) continue;
    const iso = parseSpanishDate(s, explicit ? now : published ?? now);
    if (iso && inWindow(iso, now)) return iso;
  }
  return null;
}

function venueFrom(text) {
  const m = text.match(/\ben (?:el |la |los |las )?((?:predio|parque|plaza|club|centro|sal[oó]n|estadio|teatro|camping|anfiteatro|paseo|complejo|polideportivo|museo|biblioteca|escuela)[^.,(;]{2,60})(?:\s*\(([^)]{3,80})\))?/i);
  return m ? { venue: clean(m[1]), address: clean(m[2] ?? "") || undefined } : null;
}

export async function run(now = new Date()) {
  const events = [];
  for (const src of TOWN_SOURCES) {
    let items = [];
    try { items = await src.items(); } catch (e) { console.warn(`  towns: ${src.town} failed: ${e.message}`); continue; }
    let kept = 0;
    for (const it of items) {
      const blob = `${it.title} ${it.text}`;
      if (!it.title || !EVENT_WORDS.test(blob) || SKIP_WORDS.test(it.title)) continue;
      if (!it.published || now - it.published > MAX_POST_AGE_DAYS * 86_400_000) continue; // old news never announces this week
      const startsAt = upcomingDate(it.text, it.published, now);
      if (!startsAt) continue;
      const place = venueFrom(it.text);
      const geo = place ? await geocode(place.venue, place.address, src.town) : null;
      const ev = normalizeEvent({
        title: it.title,
        description: it.text.slice(0, 600),
        startsAt,
        venueName: place?.venue ?? src.town,
        address: place?.address ? `${place.address}, ${src.town}` : `${src.town} (centro, ubicación aproximada)`,
        lat: geo?.lat ?? src.center.lat,
        lng: geo?.lng ?? src.center.lng,
        category: guessCategory(blob),
        price: /gratuit|gratis|libre y gratuita/i.test(blob) ? { free: true, currency: "ARS" } : undefined,
        sourceType: "municipal",
        sourceName: src.sourceName,
        sourceUrl: it.url,
        imageUrl: it.image,
      });
      if (ev) { events.push(ev); kept++; }
    }
    console.log(`towns: ${src.town}: ${kept} of ${items.length} posts look like upcoming events`);
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("towns", await run());
}
