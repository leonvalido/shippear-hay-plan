/**
 * npm run build-events
 *
 * data/private/raw/*.json (RawEvent[]) + data/private/tiktok-rosario.json (social captions)
 *   -> Claude extraction (captions only; skipped without ANTHROPIC_API_KEY)
 *   -> Georef geocoding for events without coordinates (cache: data/private/geocache.json)
 *   -> dedupe by fingerprint (mergeEvents), drop past events and anything outside Rosario
 *   -> data/events.json sorted by startsAt.
 *
 * With no inputs at all the current data/events.json is left untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { RawEventSchema, type Event, type RawEvent } from "../src/lib/events/schema";
import { eventId, fingerprint, mergeEvents } from "../src/lib/events/normalize";
import { SocialPostSchema, extractEventsFromCaptions, type SocialPost } from "../src/lib/events/extract";
import { barrioFromCoords, geocodeAddress, geocodePlaces, geocodeVenue, inRosario, type GeoCache } from "../src/lib/events/geocode";
import { isMidnight, toRosarioISO } from "../src/lib/events/time";
import { fillShortTitles, type TitleCache } from "../src/lib/events/titles";
import { isMockMode } from "../src/lib/ai";

const ROOT = process.cwd();
const PRIVATE = path.join(ROOT, "data", "private");
const RAW_DIR = path.join(PRIVATE, "raw");
const SOCIAL_FILE = path.join(PRIVATE, "tiktok-rosario.json");
const CACHE_FILE = path.join(PRIVATE, "geocache.json");
const TITLES_FILE = path.join(PRIVATE, "titles-cache.json");
const OUT_FILE = path.join(ROOT, "data", "events.json");
const GEOCODE_CONCURRENCY = 1; // Nominatim allows one request per second

loadEnvLocal();

const counts = { titled: 0, rawFiles: 0, rawValid: 0, rawInvalid: 0, posts: 0, extracted: 0, geocoded: 0, geocodeMiss: 0, merged: 0, past: 0, outside: 0, written: 0 };

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.warn(`  ! could not parse ${path.relative(ROOT, file)}: ${(err as Error).message}`);
    return undefined;
  }
}

function readRawFiles(): RawEvent[] {
  if (!fs.existsSync(RAW_DIR)) return [];
  const out: RawEvent[] = [];
  for (const name of fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const data = readJson(path.join(RAW_DIR, name));
    const list = Array.isArray(data) ? data : Array.isArray((data as { events?: unknown[] })?.events) ? (data as { events: unknown[] }).events : [];
    counts.rawFiles++;
    let ok = 0;
    for (const item of list) {
      const p = RawEventSchema.safeParse(item);
      if (p.success) { out.push(p.data); ok++; } else counts.rawInvalid++;
    }
    console.log(`  raw/${name}: ${ok}/${list.length} válidos`);
  }
  counts.rawValid = out.length;
  return out;
}

function readSocialPosts(): SocialPost[] {
  if (!fs.existsSync(SOCIAL_FILE)) return [];
  const data = readJson(SOCIAL_FILE);
  const list = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown[] })?.items) ? (data as { items: unknown[] }).items : [];
  const posts: SocialPost[] = [];
  for (const item of list) {
    const p = SocialPostSchema.safeParse(item);
    if (p.success) posts.push(p.data);
  }
  counts.posts = posts.length;
  return posts;
}

async function geocodeMissing(events: RawEvent[]): Promise<void> {
  const cache: GeoCache = fs.existsSync(CACHE_FILE) ? ((readJson(CACHE_FILE) as GeoCache) ?? {}) : {};
  const todo = events.filter((e) => e.lat === undefined || e.lng === undefined);
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const e = todo[next++]!;
      let p = e.address ? await geocodeAddress(e.address, cache) : undefined;
      if (!p) p = await geocodePlaces(e.address ? `${e.venueName}, ${e.address}` : e.venueName, cache);
      if (!p) p = await geocodeVenue(e.venueName, cache);
      if (p) { e.lat = p.lat; e.lng = p.lng; counts.geocoded++; } else counts.geocodeMiss++;
    }
  }
  await Promise.all(Array.from({ length: GEOCODE_CONCURRENCY }, worker));
  if (todo.length) {
    fs.mkdirSync(PRIVATE, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  }
}

function dedupe(events: RawEvent[]): RawEvent[] {
  const byFp = new Map<string, RawEvent>();
  for (const e of events) {
    const fp = fingerprint(e);
    const prev = byFp.get(fp);
    if (prev) { byFp.set(fp, mergeEvents(prev, e)); counts.merged++; } else byFp.set(fp, e);
  }
  return [...byFp.values()];
}

async function shortTitles(events: RawEvent[]): Promise<void> {
  const cache: TitleCache = fs.existsSync(TITLES_FILE) ? ((readJson(TITLES_FILE) as TitleCache) ?? {}) : {};
  const before = Object.keys(cache).length;
  await fillShortTitles(events, cache, { onBatch: (done, total) => console.log(`  ${done}/${total} títulos`) });
  counts.titled = Object.keys(cache).length - before;
  fs.mkdirSync(PRIVATE, { recursive: true });
  fs.writeFileSync(TITLES_FILE, JSON.stringify(cache, null, 1));
}

function finalize(events: RawEvent[], now: Date): Event[] {
  const nowMs = now.getTime();
  const createdAt = toRosarioISO(now);
  const out: Event[] = [];
  for (const e of events) {
    const ms = Date.parse(e.startsAt);
    if (Number.isNaN(ms) || ms < nowMs) { counts.past++; continue; }
    if (e.lat !== undefined && e.lng !== undefined && !inRosario({ lat: e.lat, lng: e.lng })) { counts.outside++; continue; }
    if (!e.barrio && e.lat !== undefined && e.lng !== undefined) e.barrio = barrioFromCoords(e.lat, e.lng);
    if (e.timeUnknown === undefined && isMidnight(e.startsAt)) e.timeUnknown = true;
    out.push({ ...e, id: eventId(e), status: "published", fingerprint: fingerprint(e), createdAt });
  }
  // same id twice can only happen through hash collision; keep the first
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

async function main() {
  const now = new Date();
  console.log(`build-events · ${toRosarioISO(now)} · modo ${isMockMode() ? "sin API key (no se extraen captions)" : "con API key"}`);

  console.log("1. Fuentes RawEvent[]:");
  const raw = readRawFiles();
  if (counts.rawFiles === 0) console.log("  (no hay data/private/raw/*.json)");

  console.log("2. Captions de redes:");
  const posts = readSocialPosts();
  let extracted: RawEvent[] = [];
  if (posts.length === 0) console.log("  (no hay data/private/tiktok-rosario.json)");
  else if (isMockMode()) console.log(`  ${posts.length} posts, extracción salteada (sin ANTHROPIC_API_KEY)`);
  else {
    extracted = await extractEventsFromCaptions(posts, {
      now,
      onBatch: (done, total, found) => console.log(`  ${done}/${total} posts · ${found} eventos`),
    });
    counts.extracted = extracted.length;
  }

  const all = [...raw, ...extracted];
  if (all.length === 0) {
    console.log("Sin entradas: se conserva data/events.json tal como está.");
    return;
  }

  console.log("3. Geocodificando con Georef…");
  await geocodeMissing(all);
  console.log(`  ${counts.geocoded} resueltas, ${counts.geocodeMiss} sin resolver`);

  const deduped = dedupe(all);
  console.log(`4. Títulos cortos${isMockMode() ? " (mock: recorte a 40 caracteres)" : ""}…`);
  await shortTitles(deduped);
  console.log(`  ${counts.titled} nuevos, resto desde data/private/titles-cache.json`);

  const events = finalize(deduped, now);
  counts.written = events.length;
  fs.writeFileSync(OUT_FILE, JSON.stringify(events, null, 1) + "\n");
  console.log(`5. Escrito data/events.json: ${events.length} eventos`);
  console.log(
    `   entradas ${all.length} (raw ${counts.rawValid}, extraídos ${counts.extracted}, inválidos ${counts.rawInvalid}) · fusionados ${counts.merged} · pasados ${counts.past} · fuera de Rosario ${counts.outside}`,
  );
}

main().catch((err) => {
  console.error("build-events falló:", (err as Error).message);
  process.exit(1);
});
