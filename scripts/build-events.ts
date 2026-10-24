/**
 * npm run build-events            (EXTRACT_RESTO=1 npm run build-events to include the 11k "resto" posts)
 *
 * Inputs under data/private/ (git-ignored, read-only here):
 *   raw/*.json                      RawEvent[] from the ingestion scripts
 *   eventos-argon.json              radar extractions (extraccion.es_evento) -> RawEvent directly
 *   eventos-rosario.json            radar deduplicated events                 -> RawEvent directly
 *   html/venti/rosario-events.json  Venti export                              -> RawEvent directly
 *   tiktok-rosario.json, tiktok-rosario-nuevos.json, tiktok-rosario-ranked.json (evento_puntaje >= 55),
 *   tiktok-rosario-resto*.json (opt-in)   social captions -> Claude extraction, cached per video_id in
 *                                         extract-cache.json (skipped without ANTHROPIC_API_KEY)
 *   organizadores-rosario.json      canonical venue / organizer names
 * Then: geocoding (geocache.json), dedupe by fingerprint, short titles (titles-cache.json),
 * drop past and out-of-area events, write data/events.json sorted by startsAt.
 * Every cache makes reruns idempotent and cheap. With no inputs the current data/events.json is kept.
 */
import fs from "node:fs";
import path from "node:path";
import { RawEventSchema, type Event, type RawEvent } from "../src/lib/events/schema";
import { addContext, eventId, fingerprint, looksLikeSameEvent, mergeEvents } from "../src/lib/events/normalize";
import { SocialPostSchema, extractEventsFromCaptions, type SocialPost } from "../src/lib/events/extract";
import { barrioFromCoords, geocodeAddress, geocodePlaces, geocodeVenue, inRosario, type GeoCache } from "../src/lib/events/geocode";
import { isMidnight, toRosarioISO } from "../src/lib/events/time";
import { fillShortTitles, type TitleCache } from "../src/lib/events/titles";
import { isMockMode } from "../src/lib/ai";
import { OrganizerIndex } from "../src/lib/events/organizers";
import { RadarRowSchema, VentiRowSchema, radarRowToRaw, ventiRowToRaw } from "../src/lib/events/sources";
import { rosarioDate } from "../src/lib/events/time";
import { MAX_LOOKUPS_PER_RUN, fillOfficialLinks, type LinkCache } from "../src/lib/events/officialLinks";
import { MAX_PRICE_LOOKUPS, fillPrices, type PriceCache } from "../src/lib/events/prices";
import { applyLinkPrices, applyVenues, indexLinkPrices, indexVenues, isSidecar } from "../src/lib/events/sidecars";

const ROOT = process.cwd();
const PRIVATE = path.join(ROOT, "data", "private");
const RAW_DIR = path.join(PRIVATE, "raw");
const CACHE_FILE = path.join(PRIVATE, "geocache.json");
const EXTRACT_CACHE = path.join(PRIVATE, "extract-cache.json");
const ORGANIZERS_FILE = path.join(PRIVATE, "organizadores-rosario.json");
const LINKS_FILE = path.join(PRIVATE, "links-cache.json");
const PRICES_FILE = path.join(PRIVATE, "prices-cache.json");
const MIN_SCORE = 55; // evento_puntaje threshold for ranked posts
const EXTRACT_CHUNK = 100; // posts per cache flush
const TITLES_FILE = path.join(PRIVATE, "titles-cache.json");
const OUT_FILE = path.join(ROOT, "data", "events.json");
const GEOCODE_CONCURRENCY = 1; // Nominatim allows one request per second

loadEnvLocal();

const counts = { titled: 0, rawFiles: 0, rawValid: 0, rawInvalid: 0, posts: 0, extracted: 0, geocoded: 0, geocodeMiss: 0, merged: 0, past: 0, outside: 0, written: 0, venueFixed: 0, sourceFixed: 0 };
/** One line per input in the final summary. */
const sources: { name: string; read: number; kept: number; note?: string }[] = [];

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
  for (const name of fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_") && !isSidecar(f)).sort()) {
    const data = readJson(path.join(RAW_DIR, name));
    const list = Array.isArray(data) ? data : Array.isArray((data as { events?: unknown[] })?.events) ? (data as { events: unknown[] }).events : [];
    counts.rawFiles++;
    let ok = 0;
    for (const item of list) {
      const p = RawEventSchema.safeParse(withRating(item));
      if (p.success) { out.push(p.data); ok++; } else counts.rawInvalid++;
    }
    console.log(`  raw/${name}: ${ok}/${list.length} válidos`);
    sources.push({ name: `raw/${name}`, read: list.length, kept: ok });
  }
  counts.rawValid = out.length;
  return out;
}

/**
 * datos writes extras the schema does not know: meta.rating / meta.userRatingCount -> `rating`;
 * music, meta.music, meta.editorialSummary, meta.reviews -> transient `context` for the AI pass.
 */
function withRating(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const o = { ...(item as Record<string, unknown>) };
  const meta = (o.meta ?? {}) as Record<string, unknown>;
  if (!o.rating && typeof meta.rating === "number") o.rating = { value: meta.rating, count: typeof meta.userRatingCount === "number" ? meta.userRatingCount : 0 };
  const ctx = { context: typeof o.context === "string" ? o.context : undefined };
  const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as { text?: string })?.text ?? "")).filter(Boolean).slice(0, 3).join(" | ") : undefined);
  addContext(ctx, "música", str(o.music ?? meta.music));
  addContext(ctx, "público", str(o.crowd ?? meta.crowd));
  addContext(ctx, "Google Places", str(meta.editorialSummary));
  addContext(ctx, "reseñas", str(meta.reviews));
  if (ctx.context) o.context = ctx.context;
  return o;
}

function listOf(data: unknown, keys = ["items", "events", "posts"]): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") for (const k of keys) if (Array.isArray((data as Record<string, unknown>)[k])) return (data as Record<string, unknown[]>)[k]!;
  return [];
}

// ---------- radar extractions (no Claude call) ----------

function readRadarEvents(file: string, label: string, today: string): RawEvent[] {
  const full = path.join(PRIVATE, file);
  if (!fs.existsSync(full)) return [];
  const list = listOf(readJson(full));
  const out: RawEvent[] = [];
  const why: Record<string, number> = {};
  for (const item of list) {
    const row = RadarRowSchema.safeParse(item);
    if (!row.success) { why.invalid = (why.invalid ?? 0) + 1; continue; }
    const r = radarRowToRaw(row.data, today);
    if (r.event) out.push(r.event);
    else why[r.reason ?? "?"] = (why[r.reason ?? "?"] ?? 0) + 1;
  }
  const note = Object.entries(why).map(([k, v]) => `${k} ${v}`).join(", ");
  console.log(`  ${label}: ${out.length}/${list.length} eventos${note ? ` (${note})` : ""}`);
  sources.push({ name: label, read: list.length, kept: out.length, note });
  return out;
}

function readVenti(): RawEvent[] {
  const full = path.join(PRIVATE, "html", "venti", "rosario-events.json");
  if (!fs.existsSync(full)) return [];
  const list = listOf(readJson(full));
  const out: RawEvent[] = [];
  for (const item of list) {
    const row = VentiRowSchema.safeParse(item);
    const e = row.success ? ventiRowToRaw(row.data) : undefined;
    if (e) out.push(e);
  }
  console.log(`  venti/rosario-events.json: ${out.length}/${list.length} eventos`);
  sources.push({ name: "html/venti/rosario-events.json", read: list.length, kept: out.length });
  return out;
}

// ---------- social captions with a per-post extraction cache ----------

type ExtractCache = Record<string, { at: string; events: RawEvent[] }>;
type ScoredPost = SocialPost & { video_id?: string | number; evento_puntaje?: number };

function postId(p: ScoredPost): string {
  if (p.video_id !== undefined && p.video_id !== null) return String(p.video_id);
  return p.url.replace(/\/+$/, "").split("/").pop() || p.url;
}

function readPosts(file: string, opts: { minScore?: number } = {}): { posts: ScoredPost[]; read: number; skippedScore: number } {
  const full = path.join(PRIVATE, file);
  if (!fs.existsSync(full)) return { posts: [], read: 0, skippedScore: 0 };
  const list = listOf(readJson(full));
  const posts: ScoredPost[] = [];
  let skippedScore = 0;
  for (const item of list) {
    const p = SocialPostSchema.safeParse(item);
    if (!p.success) continue;
    const extra = item as { video_id?: string | number; evento_puntaje?: number };
    const score = typeof extra.evento_puntaje === "number" ? extra.evento_puntaje : undefined;
    if (opts.minScore !== undefined && score !== undefined && score < opts.minScore) { skippedScore++; continue; }
    posts.push({ ...p.data, video_id: extra.video_id, evento_puntaje: score });
  }
  return { posts, read: list.length, skippedScore };
}

function loadExtractCache(): ExtractCache {
  if (!fs.existsSync(EXTRACT_CACHE)) return {};
  const data = readJson(EXTRACT_CACHE);
  return data && typeof data === "object" ? (data as ExtractCache) : {};
}
function saveExtractCache(cache: ExtractCache) {
  fs.mkdirSync(PRIVATE, { recursive: true });
  fs.writeFileSync(EXTRACT_CACHE, JSON.stringify(cache));
}

/** Extracts the posts missing from the cache (live mode only), returns events for every post of the source. */
async function extractSource(label: string, posts: ScoredPost[], cache: ExtractCache, now: Date, read: number, skippedScore: number): Promise<RawEvent[]> {
  const out: RawEvent[] = [];
  const todo: ScoredPost[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    const id = postId(p);
    if (seen.has(id)) continue;
    seen.add(id);
    const hit = cache[id];
    if (hit) out.push(...hit.events.map((e) => RawEventSchema.safeParse(e)).filter((r) => r.success).map((r) => r.data));
    else todo.push(p);
  }
  let fresh = 0;
  if (todo.length && isMockMode()) {
    console.log(`  ${label}: ${posts.length} posts, ${out.length} eventos en caché, ${todo.length} sin extraer (sin ANTHROPIC_API_KEY)`);
  } else {
    for (let i = 0; i < todo.length; i += EXTRACT_CHUNK) {
      const chunk = todo.slice(i, i + EXTRACT_CHUNK);
      const events = await extractEventsFromCaptions(chunk, { now });
      const byUrl = new Map<string, RawEvent[]>();
      for (const e of events) if (e.sourceUrl) byUrl.set(e.sourceUrl, [...(byUrl.get(e.sourceUrl) ?? []), e]);
      const at = now.toISOString();
      for (const p of chunk) cache[postId(p)] = { at, events: byUrl.get(p.url) ?? [] };
      saveExtractCache(cache);
      out.push(...events);
      fresh += events.length;
      console.log(`  ${label}: ${Math.min(i + EXTRACT_CHUNK, todo.length)}/${todo.length} posts nuevos · ${fresh} eventos nuevos`);
    }
    console.log(`  ${label}: ${posts.length} posts (${todo.length} nuevos) -> ${out.length} eventos`);
  }
  counts.posts += posts.length;
  counts.extracted += out.length;
  const note = [skippedScore ? `puntaje < ${MIN_SCORE}: ${skippedScore}` : "", todo.length && isMockMode() ? `${todo.length} sin extraer` : ""].filter(Boolean).join(", ");
  sources.push({ name: label, read, kept: out.length, note });
  return out;
}

async function readSocial(now: Date): Promise<RawEvent[]> {
  const cache = loadExtractCache();
  const out: RawEvent[] = [];
  const files: { file: string; minScore?: number }[] = [
    { file: "tiktok-rosario-ranked.json", minScore: MIN_SCORE },
    { file: "tiktok-rosario.json", minScore: MIN_SCORE }, // same posts as ranked when both exist; unscored rows pass
    { file: "tiktok-rosario-nuevos.json" },
  ];
  if (process.env.EXTRACT_RESTO === "1") files.push({ file: "tiktok-rosario-resto-ranked.json", minScore: MIN_SCORE }, { file: "tiktok-rosario-resto.json", minScore: MIN_SCORE });
  else console.log("  (tiktok-rosario-resto*.json salteado; EXTRACT_RESTO=1 para incluirlo)");
  // posts scored in ranked.json also filter the unscored copy in tiktok-rosario.json
  const scores = new Map<string, number>();
  const done = new Set<string>();
  for (const f of files) {
    const { posts, read, skippedScore } = readPosts(f.file, { minScore: f.minScore });
    if (read === 0) { console.log(`  (no hay ${f.file})`); continue; }
    for (const p of posts) if (p.evento_puntaje !== undefined) scores.set(postId(p), p.evento_puntaje);
    let belowKnownScore = 0;
    const fresh = posts.filter((p) => {
      const id = postId(p);
      if (done.has(id)) return false;
      const known = scores.get(id);
      if (p.evento_puntaje === undefined && known !== undefined && known < MIN_SCORE) { belowKnownScore++; return false; }
      done.add(id);
      return true;
    });
    out.push(...(await extractSource(f.file, fresh, cache, now, read, skippedScore + belowKnownScore)));
  }
  return out;
}

// ---------- sidecars from the analysis session ----------

function applySidecarVenues(events: RawEvent[]): void {
  const file = path.join(RAW_DIR, "venues-places.json");
  if (!fs.existsSync(file)) { console.log("  (no hay raw/venues-places.json)"); return; }
  const index = indexVenues(listOf(readJson(file)));
  const s = applyVenues(events, index);
  console.log(`  venues-places.json: ${s.matched} eventos con lugar conocido · ${s.coords} coordenadas · ${s.addresses} direcciones · ${s.ratings} puntajes · ${s.links} webs`);
  sources.push({ name: "raw/venues-places.json", read: index.size, kept: s.matched, note: "enriquecimiento de lugares" });
}

function applySidecarLinkPrices(events: RawEvent[]): void {
  const files = fs.existsSync(RAW_DIR) ? fs.readdirSync(RAW_DIR).filter((f) => /^links-prices.*\.json$/.test(f)).sort() : [];
  if (files.length === 0) { console.log("  (no hay raw/links-prices*.json)"); return; }
  const index = indexLinkPrices(files.map((f) => listOf(readJson(path.join(RAW_DIR, f)))));
  const s = applyLinkPrices(events, index);
  console.log(`  ${files.join(", ")}: ${index.size} filas · ${s.matched} eventos · ${s.linked} links oficiales · ${s.priced} precios`);
  sources.push({ name: files.join("+"), read: index.size, kept: s.matched, note: `${s.linked} links, ${s.priced} precios` });
}

// ---------- organizers ----------

function applyOrganizers(events: RawEvent[]): void {
  if (!fs.existsSync(ORGANIZERS_FILE)) { console.log("  (no hay organizadores-rosario.json)"); return; }
  const index = OrganizerIndex.fromJson(readJson(ORGANIZERS_FILE));
  for (const e of events) {
    const c = index.apply(e);
    if (c.venue) counts.venueFixed++;
    if (c.source) counts.sourceFixed++;
  }
  console.log(`  ${index.size} organizadores · ${counts.venueFixed} lugares normalizados · ${counts.sourceFixed} fuentes renombradas`);
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
  // pass 1: exact fingerprint
  const byFp = new Map<string, RawEvent>();
  for (const e of events) {
    const fp = fingerprint(e);
    const prev = byFp.get(fp);
    if (prev) { byFp.set(fp, mergeEvents(prev, e)); counts.merged++; } else byFp.set(fp, e);
  }
  // pass 2: same date + same venue + similar title core, even when the hour differs
  const byDate = new Map<string, RawEvent[]>();
  for (const e of byFp.values()) {
    const day = e.startsAt.slice(0, 10);
    const bucket = byDate.get(day) ?? [];
    const i = bucket.findIndex((o) => looksLikeSameEvent(o, e));
    if (i >= 0) { bucket[i] = mergeEvents(bucket[i]!, e); counts.merged++; } else bucket.push(e);
    byDate.set(day, bucket);
  }
  return [...byDate.values()].flat();
}

async function officialLinks(events: RawEvent[]): Promise<void> {
  const cache: LinkCache = fs.existsSync(LINKS_FILE) ? ((readJson(LINKS_FILE) as LinkCache) ?? {}) : {};
  const save = () => { fs.mkdirSync(PRIVATE, { recursive: true }); fs.writeFileSync(LINKS_FILE, JSON.stringify(cache, null, 1)); };
  const s = await fillOfficialLinks(events, cache, {
    onBatch: (st) => { save(); console.log(`  ${st.lookedUp} buscados · ${st.found} encontrados · ${st.rejected} rechazados`); },
  });
  save();
  console.log(`  candidatos ${s.candidates} · en caché ${s.cached} · buscados ${s.lookedUp} · encontrados ${s.found} · rechazados ${s.rejected}${s.budgetStop ? ` · corte por presupuesto (${MAX_LOOKUPS_PER_RUN} por corrida)` : ""}`);
}

async function prices(events: RawEvent[]): Promise<void> {
  const cache: PriceCache = fs.existsSync(PRICES_FILE) ? ((readJson(PRICES_FILE) as PriceCache) ?? {}) : {};
  const save = () => { fs.mkdirSync(PRIVATE, { recursive: true }); fs.writeFileSync(PRICES_FILE, JSON.stringify(cache, null, 1)); };
  const s = await fillPrices(events, cache, {
    onProgress: (st) => { save(); console.log(`  ${st.fetched} páginas leídas · ${st.priced} precios · ${st.unreadable} ilegibles`); },
  });
  save();
  console.log(`  candidatos ${s.candidates} · en caché ${s.cached} · leídas ${s.fetched} · precios ${s.priced} · ilegibles ${s.unreadable} · baja confianza ${s.lowConfidence}${s.budgetStop ? ` · corte por presupuesto (${MAX_PRICE_LOOKUPS} por corrida)` : ""}`);
}

async function shortTitles(events: RawEvent[]): Promise<void> {
  const cache: TitleCache = fs.existsSync(TITLES_FILE) ? ((readJson(TITLES_FILE) as TitleCache) ?? {}) : {};
  await fillShortTitles(events, cache, { onBatch: (done, total) => { counts.titled = done; console.log(`  ${done}/${total} títulos, categorías y descripciones`); } });
  fs.mkdirSync(PRIVATE, { recursive: true });
  fs.writeFileSync(TITLES_FILE, JSON.stringify(cache, null, 1));
}

function finalize(events: RawEvent[], now: Date): Event[] {
  const nowMs = now.getTime();
  const today = rosarioDate(now);
  const createdAt = toRosarioISO(now);
  const out: Event[] = [];
  for (const e of events) {
    const ms = Date.parse(e.startsAt);
    if (e.timeUnknown === undefined && isMidnight(e.startsAt)) e.timeUnknown = true;
    // an event today with no known time is still on: compare by date, not by midnight
    const past = e.timeUnknown ? e.startsAt.slice(0, 10) < today : ms < nowMs;
    if (Number.isNaN(ms) || past) { counts.past++; continue; }
    if (e.lat !== undefined && e.lng !== undefined && !inRosario({ lat: e.lat, lng: e.lng })) { counts.outside++; continue; }
    if (!e.barrio && e.lat !== undefined && e.lng !== undefined) e.barrio = barrioFromCoords(e.lat, e.lng);
    const { context: _context, ...publicFields } = e; // transient grounding text never ships
    out.push({ ...publicFields, id: eventId(e), status: "published", fingerprint: fingerprint(e), createdAt });
  }
  // same id twice can only happen through hash collision; keep the first
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

async function main() {
  const now = new Date();
  const today = rosarioDate(now);
  console.log(`build-events · ${toRosarioISO(now)} · modo ${isMockMode() ? "sin API key (no se extraen captions)" : "con API key"}`);

  console.log("1. Fuentes RawEvent[]:");
  const raw = readRawFiles();
  if (counts.rawFiles === 0) console.log("  (no hay data/private/raw/*.json)");

  console.log("2. Extracciones del radar y Venti:");
  const radar = [
    ...readRadarEvents("eventos-argon.json", "eventos-argon.json", today),
    ...readRadarEvents("eventos-rosario.json", "eventos-rosario.json", today),
    ...readVenti(),
  ];
  if (radar.length === 0) console.log("  (nada)");

  console.log("3. Captions de redes (caché: data/private/extract-cache.json):");
  const extracted = await readSocial(now);

  const all = [...raw, ...radar, ...extracted];
  if (all.length === 0) {
    console.log("Sin entradas: se conserva data/events.json tal como está.");
    return;
  }

  console.log("4. Organizadores (lugares y fuentes canónicos):");
  applyOrganizers(all);

  console.log("4b. Lugares con Google Places (raw/venues-places.json):");
  applySidecarVenues(all);

  console.log("5. Geocodificando…");
  // An image shared by several events is a source's article collage, not the event's picture.
  {
    const uses = new Map<string, number>();
    for (const e of all) if (e.imageUrl) uses.set(e.imageUrl, (uses.get(e.imageUrl) ?? 0) + 1);
    for (const e of all) if (e.imageUrl && (uses.get(e.imageUrl) ?? 0) > 2) delete e.imageUrl;
  }
  await geocodeMissing(all);
  console.log(`  ${counts.geocoded} resueltas, ${counts.geocodeMiss} sin resolver`);

  const deduped = dedupe(all);
  console.log("5b. Links y precios precalculados (raw/links-prices*.json):");
  applySidecarLinkPrices(deduped);
  console.log(`6. Páginas oficiales (web search, caché: data/private/links-cache.json)${isMockMode() ? " (mock: solo caché)" : ""}…`);
  await officialLinks(deduped);
  console.log(`6b. Precios desde la página oficial (caché: data/private/prices-cache.json)${isMockMode() ? " (mock: solo caché)" : ""}…`);
  await prices(deduped);
  console.log(`7. Títulos cortos y descripciones${isMockMode() ? " (mock: recorte a 40 caracteres, descripciones sin tocar)" : ""}…`);
  await shortTitles(deduped);
  console.log(`  ${counts.titled} generados, resto desde data/private/titles-cache.json`);

  const events = finalize(deduped, now);
  counts.written = events.length;
  fs.writeFileSync(OUT_FILE, JSON.stringify(events, null, 1) + "\n");
  console.log(`8. Escrito data/events.json: ${events.length} eventos`);
  console.log("   Por fuente (leídos -> eventos):");
  for (const s of sources) console.log(`   - ${s.name}: ${s.read} -> ${s.kept}${s.note ? ` (${s.note})` : ""}`);
  console.log(
    `   total entradas ${all.length} · fusionados ${counts.merged} · pasados ${counts.past} · fuera de Rosario ${counts.outside} · lugares normalizados ${counts.venueFixed}`,
  );
}

main().catch((err) => {
  console.error("build-events falló:", (err as Error).message);
  process.exit(1);
});
