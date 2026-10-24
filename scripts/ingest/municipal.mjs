/**
 * Municipalidad de Rosario cultural agenda (rosario.gob.ar/agenda).
 * Listing cards give title, date card ("04.11" or "28.10 al 30.04"), tag and image;
 * the detail page gives venue, address, coordinates (from the "Cómo llego" link)
 * and the schedule rule text. Discounts ("Club de los grandes") are skipped.
 */
import * as cheerio from "cheerio";
import { fetchText, parseTime, toIso, rosarioToday, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean, absUrl, WINDOW_DAYS } from "./lib.mjs";

const BASE = "https://www.rosario.gob.ar";
const MAX_PAGES = 30;
const MAX_DETAILS = 160;

/** "28.10" → {m, d}; year is inferred relative to today. */
function cardDate(s, today, after) {
  const m = s.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  let y = today.y;
  if (after) { if (mo < after.m || (mo === after.m && d < after.d)) y = after.y + 1; else y = after.y; }
  else if (mo < today.m - 1) y += 1;
  return { y, m: mo, d };
}

export async function run(now = new Date()) {
  const today = rosarioToday(now);
  const windowEnd = Date.UTC(today.y, today.m - 1, today.d + WINDOW_DAYS);
  const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
  const cards = new Map();

  for (let page = 0; page < MAX_PAGES; page++) {
    const html = await fetchText(`${BASE}/agenda/buscar?page=${page}`);
    const $ = cheerio.load(html);
    const items = $("actividad");
    if (items.length === 0) break;
    items.each((_, el) => {
      const a = $(el).find("a.govuk-link").first();
      const href = absUrl(a.attr("href"), BASE);
      const title = clean($(el).find("h3").first().text());
      const tag = clean($(el).find(".etiqueta-actividad-card").text());
      const dateText = clean($(el).find(".fecha-card").text());
      const img = absUrl($(el).find("img").attr("src"), BASE);
      if (!href || !title || cards.has(href)) return;
      if (/descuento|club de los grandes|beneficio/i.test(`${title} ${tag}`)) return;
      const [startRaw, endRaw] = dateText.split(/\s+al\s+/);
      const start = cardDate(startRaw ?? "", today);
      if (!start) return;
      const end = endRaw ? cardDate(endRaw, today, start) : null;
      const startUtc = Date.UTC(start.y, start.m - 1, start.d);
      const endUtc = end ? Date.UTC(end.y, end.m - 1, end.d) : startUtc;
      if (startUtc > windowEnd || endUtc < todayUtc) return;
      cards.set(href, { href, title, tag, img, start, end });
    });
  }
  console.log(`municipal: ${cards.size} candidate cards in the window`);

  const events = [];
  let n = 0;
  for (const card of cards.values()) {
    if (n++ >= MAX_DETAILS) break;
    try {
      const html = await fetchText(card.href);
      const $ = cheerio.load(html);
      const lugar = $("lugar").first();
      const venueName = clean(lugar.find(".title-lugar").text());
      if (!venueName) continue; // no venue = not mappable
      const address = clean(lugar.find(".direccion-lugar").text());
      const geo = (lugar.find("a.como-llego-lugar").attr("href") ?? "").match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
      const rule = clean($(".rule-text").first().text());
      const description = $("main p").map((_, p) => clean($(p).text())).get()
        .filter((t) => t.length > 40 && !/^Lugar:|Cómo llego|Ver mapa/.test(t)).slice(0, 3).join(" ");
      const time = parseTime(rule) ?? parseTime(description) ?? { h: 0, min: 0 };
      const first = Math.max(Date.UTC(card.start.y, card.start.m - 1, card.start.d), todayUtc);
      const sd = new Date(first);
      const startsAt = toIso(sd.getUTCFullYear(), sd.getUTCMonth() + 1, sd.getUTCDate(), time.h, time.min);
      if (!inWindow(startsAt, now)) continue;
      const ev = normalizeEvent({
        title: card.title,
        description: [rule, description].filter(Boolean).join(" · "),
        startsAt,
        endsAt: card.end ? toIso(card.end.y, card.end.m, card.end.d, 23, 59) : undefined,
        venueName,
        address: address || undefined,
        lat: geo ? Number(geo[1]) : undefined,
        lng: geo ? Number(geo[2]) : undefined,
        category: guessCategory(`${card.tag} ${card.title} ${description}`, "cultura"),
        price: /entrada libre|gratuit|gratis|sin costo/i.test(`${description} ${rule}`) ? { free: true, currency: "ARS" } : undefined,
        sourceType: "municipal",
        sourceName: "Municipalidad de Rosario",
        sourceUrl: card.href,
        imageUrl: card.img,
      });
      if (ev) events.push(ev);
    } catch (e) {
      console.warn(`  municipal detail failed ${card.href}: ${e.message}`);
    }
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("municipal", await run());
}
