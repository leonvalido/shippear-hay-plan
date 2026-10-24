import { getStore, type SqliteDatabase } from "../db";
import { EventSchema, RawEventSchema, type Event, type EventsQuery, type RawEvent } from "./schema";
import { fingerprint, mergeEvents, normalizeText, titleSimilarity } from "./normalize";
import { addDays, epochMs, isMidnight, parseInstant, startOfRosarioDay, toRosarioISO } from "./time";
import seed from "../../../data/events.json";

/**
 * Event store. SQLite (table `events`, one column per schema field) when
 * node:sqlite is available, otherwise an in-memory array with the same API.
 * On first use an empty store is seeded from data/events.json.
 */

export type EventStore = {
  backend: "sqlite" | "memory";
  upsertEvent(e: Event): void;
  queryEvents(q: EventsQuery): Event[];
  getEvent(id: string): Event | undefined;
  findDuplicates(raw: RawEvent): Event[];
  stats(range: StatsRange): Stats;
  count(): number;
};

export type StatsRange = { from?: string; to?: string; status?: Event["status"] };
export type Stats = { total: number; byBarrio: { barrio: string; count: number }[]; byCategory: { category: string; count: number }[] };

type Row = {
  id: string; title: string; description: string | null; starts_at: string; starts_ms: number;
  ends_at: string | null; venue_name: string; address: string | null; lat: number | null; lng: number | null;
  barrio: string | null; category: string; price_free: number | null; price_min: number | null;
  price_max: number | null; source_type: string; source_name: string | null; source_url: string | null;
  image_url: string | null; status: string; fingerprint: string; created_at: string; search: string;
  metrics_views: number | null; metrics_likes: number | null;
  short_title: string | null; time_unknown: number | null; links: string | null;
  recurring: number | null; rating_value: number | null; rating_count: number | null; vibe: string | null;
};

const DDL = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  starts_ms INTEGER NOT NULL,
  ends_at TEXT,
  venue_name TEXT NOT NULL,
  address TEXT,
  lat REAL,
  lng REAL,
  barrio TEXT,
  category TEXT NOT NULL,
  price_free INTEGER,
  price_min REAL,
  price_max REAL,
  source_type TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  search TEXT NOT NULL,
  metrics_views INTEGER,
  metrics_likes INTEGER,
  short_title TEXT,
  time_unknown INTEGER,
  links TEXT,
  recurring INTEGER,
  rating_value REAL,
  rating_count INTEGER,
  vibe TEXT
);
CREATE INDEX IF NOT EXISTS events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS events_starts_ms ON events (starts_ms);
CREATE INDEX IF NOT EXISTS events_status ON events (status);
CREATE INDEX IF NOT EXISTS events_category ON events (category);
CREATE INDEX IF NOT EXISTS events_fingerprint ON events (fingerprint);
`;
/** Columns added after the first deploy; applied one by one on tables that predate them. */
const MIGRATIONS = [
  "ALTER TABLE events ADD COLUMN metrics_views INTEGER",
  "ALTER TABLE events ADD COLUMN metrics_likes INTEGER",
  "ALTER TABLE events ADD COLUMN short_title TEXT",
  "ALTER TABLE events ADD COLUMN time_unknown INTEGER",
  "ALTER TABLE events ADD COLUMN links TEXT",
  "ALTER TABLE events ADD COLUMN recurring INTEGER",
  "ALTER TABLE events ADD COLUMN rating_value REAL",
  "ALTER TABLE events ADD COLUMN rating_count INTEGER",
  "ALTER TABLE events ADD COLUMN vibe TEXT",
];

const COLUMNS =
  "id,title,description,starts_at,starts_ms,ends_at,venue_name,address,lat,lng,barrio,category,price_free,price_min,price_max,source_type,source_name,source_url,image_url,status,fingerprint,created_at,search,metrics_views,metrics_likes,short_title,time_unknown,links,recurring,rating_value,rating_count,vibe";

function searchText(e: Pick<Event, "title" | "venueName">) {
  return normalizeText(`${e.title} ${e.venueName}`);
}

/** Ensure fingerprint is set; keeps every other field. */
export function withFingerprint(e: Event): Event {
  return e.fingerprint ? e : { ...e, fingerprint: fingerprint(e) };
}

function toRow(e: Event): unknown[] {
  const f = withFingerprint(e);
  return [
    f.id, f.title, f.description ?? null, f.startsAt, epochMs(f.startsAt), f.endsAt ?? null, f.venueName,
    f.address ?? null, f.lat ?? null, f.lng ?? null, f.barrio ?? null, f.category,
    f.price ? (f.price.free ? 1 : 0) : null, f.price?.min ?? null, f.price?.max ?? null,
    f.sourceType, f.sourceName ?? null, f.sourceUrl ?? null, f.imageUrl ?? null, f.status, f.fingerprint,
    f.createdAt, searchText(f), f.metrics?.views ?? null, f.metrics?.likes ?? null,
    f.shortTitle ?? null, f.timeUnknown === undefined ? null : f.timeUnknown ? 1 : 0,
    f.links?.length ? JSON.stringify(f.links) : null,
    f.recurring === undefined ? null : f.recurring ? 1 : 0, f.rating?.value ?? null, f.rating?.count ?? null,
    f.vibe ? JSON.stringify(f.vibe) : null,
  ];
}

function fromRow(r: Row): Event {
  const e: Record<string, unknown> = {
    id: r.id, title: r.title, startsAt: r.starts_at, venueName: r.venue_name, category: r.category,
    sourceType: r.source_type, status: r.status, fingerprint: r.fingerprint, createdAt: r.created_at,
  };
  if (r.description) e.description = r.description;
  if (r.ends_at) e.endsAt = r.ends_at;
  if (r.address) e.address = r.address;
  if (r.lat !== null) e.lat = r.lat;
  if (r.lng !== null) e.lng = r.lng;
  if (r.barrio) e.barrio = r.barrio;
  if (r.price_free !== null) {
    e.price = { free: r.price_free === 1, currency: "ARS" };
    if (r.price_min !== null) (e.price as Record<string, unknown>).min = r.price_min;
    if (r.price_max !== null) (e.price as Record<string, unknown>).max = r.price_max;
  }
  if (r.source_name) e.sourceName = r.source_name;
  if (r.source_url) e.sourceUrl = r.source_url;
  if (r.image_url) e.imageUrl = r.image_url;
  if (r.short_title) e.shortTitle = r.short_title;
  if (r.time_unknown !== null) e.timeUnknown = r.time_unknown === 1;
  if (r.links) {
    try { e.links = JSON.parse(r.links); } catch { /* ignore a corrupt cell */ }
  }
  if (r.recurring === 1) e.recurring = true;
  if (r.vibe) {
    try { e.vibe = JSON.parse(r.vibe); } catch { /* ignore a corrupt cell */ }
  }
  if (r.rating_value !== null) e.rating = { value: r.rating_value, count: r.rating_count ?? 0 };
  if (r.metrics_views !== null || r.metrics_likes !== null) {
    e.metrics = { ...(r.metrics_views !== null ? { views: r.metrics_views } : {}), ...(r.metrics_likes !== null ? { likes: r.metrics_likes } : {}) };
  }
  return e as Event;
}

// ---------- query helpers shared by both backends ----------

type Resolved = {
  fromMs: number; toMs: number; status: string; category?: string; q?: string;
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number }; limit: number;
};

export function parseBbox(s?: string): Resolved["bbox"] | undefined {
  if (!s) return undefined;
  const p = s.split(",").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return undefined;
  return { minLng: p[0]!, minLat: p[1]!, maxLng: p[2]!, maxLat: p[3]! };
}

function resolve(q: EventsQuery, now = new Date()): Resolved {
  // default lower bound is the start of today in Rosario: events that already started still count today
  const from = parseInstant(q.from) ?? startOfRosarioDay(now);
  const to = parseInstant(q.to) ?? addDays(from, 14);
  return {
    fromMs: from.getTime(), toMs: to.getTime(), status: q.status, category: q.category,
    q: q.q ? normalizeText(q.q) : undefined, bbox: parseBbox(q.bbox), limit: q.limit,
  };
}

function matches(e: Event, r: Resolved): boolean {
  const ms = epochMs(e.startsAt);
  if (!(ms >= r.fromMs && ms <= r.toMs)) return false;
  if (e.status !== r.status) return false;
  if (r.category && e.category !== r.category) return false;
  if (r.q && !searchText(e).includes(r.q)) return false;
  if (r.bbox) {
    if (e.lat === undefined || e.lng === undefined) return false;
    if (e.lng < r.bbox.minLng || e.lng > r.bbox.maxLng || e.lat < r.bbox.minLat || e.lat > r.bbox.maxLat) return false;
  }
  return true;
}

function resolveRange(range: StatsRange, now = new Date()) {
  const from = parseInstant(range.from) ?? startOfRosarioDay(now);
  const to = parseInstant(range.to) ?? addDays(from, 14);
  return { fromMs: from.getTime(), toMs: to.getTime(), status: range.status ?? "published" };
}

function tally(events: Pick<Event, "barrio" | "category">[]): Stats {
  const barrios = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const e of events) {
    const b = e.barrio?.trim() || "Sin barrio";
    barrios.set(b, (barrios.get(b) ?? 0) + 1);
    categories.set(e.category, (categories.get(e.category) ?? 0) + 1);
  }
  const desc = (a: { count: number }, b: { count: number }) => b.count - a.count;
  return {
    total: events.length,
    byBarrio: [...barrios].map(([barrio, count]) => ({ barrio, count })).sort(desc),
    byCategory: [...categories].map(([category, count]) => ({ category, count })).sort(desc),
  };
}

/** Candidates for duplication: same day, then same fingerprint or similar title. */
function pickDuplicates(raw: RawEvent, sameDay: Event[]): Event[] {
  const fp = fingerprint(raw);
  return sameDay.filter((e) => {
    if ((e.fingerprint ?? fingerprint(e)) === fp) return true;
    const sim = titleSimilarity(e.title, raw.title);
    const sameVenue = normalizeText(e.venueName).split(" ")[0] === normalizeText(raw.venueName).split(" ")[0];
    return sim >= 0.8 || (sim >= 0.5 && sameVenue);
  });
}

function dayWindow(iso: string): { from: number; to: number } {
  const d = parseInstant(iso) ?? new Date();
  const from = new Date(`${toRosarioISO(d).slice(0, 10)}T00:00:00-03:00`).getTime();
  return { from, to: from + 86_400_000 - 1 };
}

// ---------- backends ----------

function memoryBackend(): EventStore {
  const map = new Map<string, Event>();
  return {
    backend: "memory",
    upsertEvent: (e) => void map.set(e.id, withFingerprint(e)),
    getEvent: (id) => map.get(id),
    count: () => map.size,
    queryEvents: (q) => {
      const r = resolve(q);
      return [...map.values()]
        .filter((e) => matches(e, r))
        .sort((a, b) => epochMs(a.startsAt) - epochMs(b.startsAt))
        .slice(0, r.limit);
    },
    stats: (range) => {
      const r = resolveRange(range);
      return tally([...map.values()].filter((e) => {
        const ms = epochMs(e.startsAt);
        return ms >= r.fromMs && ms <= r.toMs && e.status === r.status;
      }));
    },
    findDuplicates: (raw) => {
      const w = dayWindow(raw.startsAt);
      const sameDay = [...map.values()].filter((e) => {
        const ms = epochMs(e.startsAt);
        return ms >= w.from && ms <= w.to && e.status !== "rejected";
      });
      return pickDuplicates(raw, sameDay);
    },
  };
}

function sqliteBackend(db: SqliteDatabase): EventStore {
  db.exec(DDL);
  for (const sql of MIGRATIONS) {
    try { db.exec(sql); } catch { /* column already there */ }
  }
  const placeholders = COLUMNS.split(",").map(() => "?").join(",");
  const upsert = db.prepare(`INSERT OR REPLACE INTO events (${COLUMNS}) VALUES (${placeholders})`);
  const getQ = db.prepare("SELECT * FROM events WHERE id = ?");
  const countQ = db.prepare("SELECT COUNT(*) AS n FROM events");
  const sameDayQ = db.prepare("SELECT * FROM events WHERE starts_ms BETWEEN ? AND ? AND status != 'rejected'");
  const statsQ = db.prepare("SELECT barrio, category FROM events WHERE starts_ms BETWEEN ? AND ? AND status = ?");

  return {
    backend: "sqlite",
    upsertEvent: (e) => void upsert.run(...toRow(e)),
    getEvent: (id) => {
      const r = getQ.get(id) as Row | undefined;
      return r ? fromRow(r) : undefined;
    },
    count: () => (countQ.get() as { n: number }).n,
    queryEvents: (q) => {
      const r = resolve(q);
      const where = ["starts_ms BETWEEN ? AND ?", "status = ?"];
      const params: unknown[] = [r.fromMs, r.toMs, r.status];
      if (r.category) { where.push("category = ?"); params.push(r.category); }
      if (r.q) { where.push("search LIKE ?"); params.push(`%${r.q.replace(/[%_]/g, " ")}%`); }
      if (r.bbox) {
        where.push("lng BETWEEN ? AND ?", "lat BETWEEN ? AND ?");
        params.push(r.bbox.minLng, r.bbox.maxLng, r.bbox.minLat, r.bbox.maxLat);
      }
      params.push(r.limit);
      const sql = `SELECT * FROM events WHERE ${where.join(" AND ")} ORDER BY starts_ms ASC LIMIT ?`;
      return (db.prepare(sql).all(...params) as Row[]).map(fromRow);
    },
    findDuplicates: (raw) => {
      const w = dayWindow(raw.startsAt);
      return pickDuplicates(raw, (sameDayQ.all(w.from, w.to) as Row[]).map(fromRow));
    },
    stats: (range) => {
      const r = resolveRange(range);
      const rows = statsQ.all(r.fromMs, r.toMs, r.status) as { barrio: string | null; category: string }[];
      return tally(rows.map((x) => ({ barrio: x.barrio ?? undefined, category: x.category as Event["category"] })));
    },
  };
}

// ---------- singleton + seeding ----------

const g = globalThis as unknown as { __eventStore?: Promise<EventStore> };

function seedEvents(): Event[] {
  const out: Event[] = [];
  for (const raw of seed as unknown[]) {
    const p = EventSchema.safeParse(raw);
    if (p.success) out.push(withFingerprint(p.data));
  }
  return out;
}

async function init(): Promise<EventStore> {
  const base = await getStore();
  let store: EventStore;
  try {
    store = base.db ? sqliteBackend(base.db) : memoryBackend();
  } catch (err) {
    console.warn("[events] sqlite table failed, using memory:", (err as Error).message);
    store = memoryBackend();
  }
  if (store.count() === 0) {
    const events = seedEvents();
    for (const e of events) store.upsertEvent(e);
    console.log(`[events] seeded ${events.length} events into ${store.backend}`);
  }
  return store;
}

export function getEventStore(): Promise<EventStore> {
  if (!g.__eventStore) g.__eventStore = init();
  return g.__eventStore;
}

// ---------- higher level helpers used by routes ----------

export type IngestResult = { inserted: number; merged: number; skipped: number };

/** Turn a RawEvent into a stored Event (new id, status, timestamps). */
export function toEvent(raw: RawEvent, id: string, status: Event["status"]): Event {
  return withFingerprint({ ...raw, timeUnknown: raw.timeUnknown ?? (isMidnight(raw.startsAt) || undefined), id, status, createdAt: toRosarioISO(new Date()) });
}

/**
 * Insert or merge a RawEvent: if an event with the same fingerprint exists, the
 * richer merge replaces it (keeps the old id and status); otherwise inserts.
 */
export function upsertRaw(store: EventStore, raw: RawEvent, id: string, status: Event["status"]): "inserted" | "merged" {
  const fp = fingerprint(raw);
  const existing = store.findDuplicates(raw).find((e) => (e.fingerprint ?? fingerprint(e)) === fp);
  if (existing) {
    const merged = mergeEvents<Event>(existing, { ...existing, ...raw });
    store.upsertEvent(withFingerprint({ ...merged, id: existing.id, status: existing.status, createdAt: existing.createdAt }));
    return "merged";
  }
  store.upsertEvent(toEvent(raw, id, status));
  return "inserted";
}

export function validateRaw(input: unknown): RawEvent | undefined {
  const p = RawEventSchema.safeParse(input);
  return p.success ? p.data : undefined;
}

/** What the list endpoint returns: enough for cards and pins. Full record on /api/events/:id. */
export type EventCard = Pick<
  Event,
  "id" | "shortTitle" | "title" | "startsAt" | "timeUnknown" | "venueName" | "lat" | "lng" | "barrio" | "category" | "price" | "sourceType" | "sourceName" | "imageUrl" | "status" | "recurring" | "rating"
> & { metrics?: { views?: number } };

export function toCard(e: Event): EventCard {
  const card: EventCard = {
    id: e.id, title: e.title, startsAt: e.startsAt, venueName: e.venueName, category: e.category, sourceType: e.sourceType, status: e.status,
  };
  if (e.shortTitle) card.shortTitle = e.shortTitle;
  if (e.timeUnknown) card.timeUnknown = true;
  if (e.lat !== undefined) card.lat = e.lat;
  if (e.lng !== undefined) card.lng = e.lng;
  if (e.barrio) card.barrio = e.barrio;
  if (e.price) card.price = e.price;
  if (e.sourceName) card.sourceName = e.sourceName;
  if (e.imageUrl) card.imageUrl = e.imageUrl;
  if (e.metrics?.views !== undefined) card.metrics = { views: e.metrics.views };
  if (e.recurring) card.recurring = true;
  if (e.rating) card.rating = e.rating;
  return card;
}
