/**
 * Shared helpers for the offline ingestion scripts (HayPlan / datos).
 * Plain ESM JavaScript with JSDoc types; Node >= 22.7 loads schema.ts via type stripping.
 * No Claude calls here: scripts only fetch public pages and write RawEvent[] JSON.
 *
 * @typedef {import("../../src/lib/events/schema.ts").RawEvent} RawEvent
 * @typedef {import("../../src/lib/events/schema.ts").EventCategory} EventCategory
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RawEventSchema, ROSARIO_BBOX } from "../../src/lib/events/schema.ts";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RAW_DIR = join(ROOT, "data", "private", "raw");
const GEOCACHE = join(ROOT, "data", "private", "geocache.json");

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 HayPlan-ingest/0.1";

export const TZ = "-03:00";
/** How far ahead we keep events (the hackathon demo window). */
export const WINDOW_DAYS = 15;

/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- polite fetching: one request per second per host ----------
/** @type {Map<string, number>} */
const lastHit = new Map();
/** @param {string} url */
async function throttle(url, minGapMs = 1000) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, headers?: Record<string, string> }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchText(url, opts = {}) {
  await throttle(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-AR,es;q=0.9,en;q=0.5", ...opts.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, headers?: Record<string, string> }} [opts]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  return JSON.parse(text);
}

// ---------- dates ----------
/** @type {Record<string, number>} */
const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};
/** @type {Record<string, number>} */
const WEEKDAYS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6,
};

/** @param {string} s */
export const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** @param {string | undefined | null} s */
export const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

/** @param {number} n */
const pad = (n) => String(n).padStart(2, "0");
/** @returns {string} ISO 8601 with the Rosario offset */
export function toIso(y, m, d, h = 0, min = 0) {
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00${TZ}`;
}

/** "Now" in Rosario wall-clock terms (year, month, day, weekday). */
export function rosarioToday(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3600_000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), dow: local.getUTCDay() };
}

/**
 * Parse "21:00", "21hs", "21 h", "21.30 hs", "21:30hs" → {h, min}.
 * @param {string} text
 * @returns {{ h: number, min: number } | null}
 */
export function parseTime(text) {
  const t = stripAccents(text.toLowerCase());
  const m =
    t.match(/(?:^|[^\d:\/.])([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\s*(?:hs\b|h\b|horas\b)/) ??
    t.match(/(?:^|[^\d:\/.])([01]?\d|2[0-3]):([0-5]\d)(?![\d\/.])/);
  if (!m) return null;
  return { h: Number(m[1]), min: Number(m[2] ?? 0) };
}

/**
 * Spanish date text → ISO with -03:00. Handles "sáb 25/10 21hs", "25 de octubre",
 * "25/10/2026", "este viernes", "hoy", "mañana", "04.11". Year is inferred as the
 * next occurrence when missing. Returns null when no date is found.
 * @param {string} text
 * @param {Date} [now]
 * @returns {string | null}
 */
export function parseSpanishDate(text, now = new Date()) {
  const t = stripAccents(clean(text).toLowerCase());
  const today = rosarioToday(now);
  const time = parseTime(t) ?? { h: 0, min: 0 };
  /** @type {number | undefined} */ let y;
  /** @type {number | undefined} */ let m;
  /** @type {number | undefined} */ let d;

  let r = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (r) {
    d = Number(r[1]); m = Number(r[2]);
    if (r[3]) y = Number(r[3].length === 2 ? "20" + r[3] : r[3]);
  }
  if (!m) {
    r = t.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})\.?(?:\s+(?:de\s+|del\s+)?(\d{4}))?/);
    if (r && MONTHS[r[2]]) { d = Number(r[1]); m = MONTHS[r[2]]; if (r[3]) y = Number(r[3]); }
  }
  if (!m) {
    if (/\bhoy\b/.test(t)) ({ y, m, d } = today);
    else if (/\bmanana\b/.test(t)) {
      const dt = new Date(Date.UTC(today.y, today.m - 1, today.d + 1));
      y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
    } else {
      const w = t.match(/\b(?:este|el|proximo|prox\.?)?\s*(domingo|lunes|martes|miercoles|jueves|viernes|sabado|dom|lun|mar|mie|jue|vie|sab)\b/);
      if (w) {
        const delta = (WEEKDAYS[w[1]] - today.dow + 7) % 7;
        const dt = new Date(Date.UTC(today.y, today.m - 1, today.d + delta));
        y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
      }
    }
  }
  if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (!y) {
    y = today.y;
    // a month well behind us means next year (e.g. "5 de enero" seen in November)
    if (m < today.m - 1) y += 1;
  }
  return toIso(y, m, d, time.h, time.min);
}

/**
 * True when the ISO date falls between today (Rosario) and today + WINDOW_DAYS.
 * @param {string} iso
 */
export function inWindow(iso, now = new Date(), days = WINDOW_DAYS) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const { y, m, d } = rosarioToday(now);
  const start = Date.UTC(y, m - 1, d) + 3 * 3600_000; // 00:00 Rosario
  return t >= start && t <= start + days * 86_400_000;
}

// ---------- categories ----------
/** @type {Array<[EventCategory, RegExp]>} */
const CATEGORY_RULES = [
  ["infantil", /\b(infantil|infancias?|ninos|ninas|ninez|familia|titeres|kids)\b/],
  ["teatro", /\b(teatro|obra|comedia|drama|stand ?up|humor|monologo|circo|danza|ballet)\b/],
  ["musica", /\b(musica|recital|concierto|banda|rock|jazz|folklore|folclore|cumbia|trap|rap|hip hop|dj|show|gira|tour|tributo|coro|orquesta|sinfonica|tango|cuarteto|festival)\b/],
  ["fiesta", /\b(fiesta|party|after|boliche|electronica|techno|house|rave|joda|previa)\b/],
  ["feria", /\b(feria|mercado|expo|exposicion|emprendedores|bazar|outlet)\b/],
  ["deporte", /\b(deporte|deportiva|partido|futbol|basquet|running|maraton|carrera|torneo|yoga|bici|cicl|padel|tenis|rugby|hockey|boxeo|tc|turismo carretera)\b/],
  ["gastronomia", /\b(gastronom|cerveza|birra|vino|cata|degustacion|cocina|food|comida|asado|pizza|cafe)\b/],
  ["charla", /\b(charla|conferencia|taller|workshop|curso|seminario|meetup|capacitacion|clase|panel|hackathon|networking|presentacion del libro|presentaciones de libros|lectura)\b/],
  ["cultura", /\b(muestra|museo|cine|pelicula|film|arte|galeria|literatura|libro|biblioteca|patrimonio|historia|visita guiada|free tour|fotografia|poesia|cultural?)\b/],
];
/**
 * @param {string} text
 * @param {EventCategory} [fallback]
 * @returns {EventCategory}
 */
export function guessCategory(text, fallback = "otro") {
  const t = stripAccents(text.toLowerCase());
  for (const [cat, re] of CATEGORY_RULES) if (re.test(t)) return cat;
  return fallback;
}

// ---------- geo ----------
/** @param {number} [lat] @param {number} [lng] */
export function inRosario(lat, lng) {
  return lat != null && lng != null && lat >= ROSARIO_BBOX.minLat && lat <= ROSARIO_BBOX.maxLat && lng >= ROSARIO_BBOX.minLng && lng <= ROSARIO_BBOX.maxLng;
}

/** @type {Record<string, { lat: number, lng: number } | null> | null} */
let geocache = null;
function loadCache() {
  if (geocache) return geocache;
  geocache = existsSync(GEOCACHE) ? JSON.parse(readFileSync(GEOCACHE, "utf8")) : {};
  return geocache;
}
function saveCache() {
  mkdirSync(dirname(GEOCACHE), { recursive: true });
  writeFileSync(GEOCACHE, JSON.stringify(geocache, null, 1));
}

/**
 * Venue + address → coordinates inside Rosario, via Georef (datos.gob.ar) with
 * Nominatim as fallback. Results (including misses) are cached in data/private/geocache.json.
 * @param {string} venueName
 * @param {string} [address]
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function geocode(venueName, address) {
  const cache = loadCache();
  const query = clean(address) || clean(venueName);
  if (!query) return null;
  const key = stripAccents(query.toLowerCase());
  if (key in cache) return cache[key];

  /** @type {{ lat: number, lng: number } | null} */
  let result = null;
  if (address) {
    try {
      const u = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(address)}&localidad=Rosario&provincia=Santa%20Fe&max=1`;
      const j = await fetchJson(u);
      const u0 = j.direcciones?.[0]?.ubicacion;
      if (u0 && inRosario(u0.lat, u0.lon)) result = { lat: u0.lat, lng: u0.lon };
    } catch (e) {
      console.warn(`  georef failed for "${address}": ${/** @type {Error} */ (e).message}`);
    }
  }
  if (!result) {
    const queries = [address && `${address}, Rosario, Santa Fe, Argentina`, `${venueName}, Rosario, Argentina`].filter(Boolean);
    for (const q of /** @type {string[]} */ (queries)) {
      try {
        const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
        const j = await fetchJson(u);
        const hit = j[0];
        if (hit && inRosario(Number(hit.lat), Number(hit.lon))) { result = { lat: Number(hit.lat), lng: Number(hit.lon) }; break; }
      } catch (e) {
        console.warn(`  nominatim failed for "${q}": ${/** @type {Error} */ (e).message}`);
      }
    }
  }
  cache[key] = result;
  saveCache();
  return result;
}

// ---------- normalization + output ----------
/**
 * Validate a candidate against RawEventSchema. Coordinates outside Gran Rosario
 * are dropped (the event is kept, un-geocoded). Returns null when invalid.
 * @param {Record<string, unknown>} input
 * @returns {RawEvent | null}
 */
export function normalizeEvent(input) {
  /** @type {Record<string, any>} */
  const c = { ...input };
  if (typeof c.title === "string") c.title = clean(c.title).slice(0, 160);
  if (typeof c.description === "string") c.description = clean(c.description).slice(0, 2000) || undefined;
  if (typeof c.venueName === "string") c.venueName = clean(c.venueName);
  if (typeof c.address === "string") c.address = clean(c.address) || undefined;
  if (!inRosario(c.lat, c.lng)) { delete c.lat; delete c.lng; }
  for (const k of Object.keys(c)) if (c[k] === undefined || c[k] === null || c[k] === "") delete c[k];
  const r = RawEventSchema.safeParse(c);
  if (!r.success) {
    console.warn(`  skip "${String(c.title ?? "?").slice(0, 50)}": ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    return null;
  }
  return r.data;
}

/** @param {RawEvent[]} events */
export function dedupe(events) {
  const seen = new Set();
  return events.filter((e) => {
    const k = `${stripAccents(e.title.toLowerCase())}|${e.startsAt.slice(0, 10)}|${stripAccents(e.venueName.toLowerCase())}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * @param {string} source
 * @param {RawEvent[]} events
 */
export function writeRaw(source, events) {
  mkdirSync(RAW_DIR, { recursive: true });
  const file = join(RAW_DIR, `${source}.json`);
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  writeFileSync(file, JSON.stringify(sorted, null, 1));
  console.log(`${source}: ${sorted.length} events -> ${file}`);
  return file;
}

/** @param {string | undefined} href @param {string} base */
export const absUrl = (href, base) => {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return undefined; }
};
