import type { Event, RawEvent } from "./schema";

/**
 * Text normalisation, fingerprints and merging. Pure functions, no I/O.
 *
 * fingerprint = normalised title (lowercase, no accents, no stopwords)
 *             + "|" + date (YYYY-MM-DD, as written in startsAt)
 *             + "|" + first word of the venue
 */

const STOPWORDS = new Set([
  "a", "al", "ante", "con", "de", "del", "desde", "el", "en", "entre", "es", "hacia", "hasta", "la", "las",
  "lo", "los", "mas", "más", "o", "para", "por", "que", "se", "sin", "sobre", "su", "sus", "un", "una",
  "unas", "unos", "y", "e", "the", "of", "and", "in", "at", "vs", "feat", "ft", "x", "live", "vivo",
  "show", "presenta", "fiesta", "noche", "evento", "edicion", "edición", "gratis", "entrada", "libre",
]);

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Significant words of a title: normalised, stopwords and 1-letter tokens removed. */
export function titleTokens(title: string): string[] {
  return normalizeText(title)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Calendar date part of an ISO string as written (we never shift the offset). */
export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

export function fingerprint(e: Pick<RawEvent, "title" | "startsAt" | "venueName">): string {
  const title = titleTokens(e.title).join(" ") || normalizeText(e.title);
  const venue = normalizeText(e.venueName).split(" ")[0] ?? "";
  return `${title}|${dateOf(e.startsAt)}|${venue}`;
}

/** Jaccard similarity between the significant words of two titles (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const FOOTER = "\n\nFuentes: ";
const MAX_DESCRIPTION = 2000;
const MAX_LINKS = 6;

export type Link = { label: string; url: string };

/** Lower = more official/specific. Decides which record's sourceUrl survives a merge. */
const SOURCE_RANK: Record<RawEvent["sourceType"], number> = {
  ticketing: 0, platform: 1, manual: 2, municipal: 3, press: 4, instagram: 5, tiktok: 5, flyer: 6,
};
const SOURCE_LABEL: Record<RawEvent["sourceType"], string> = {
  ticketing: "Entradas", platform: "Página del evento", manual: "Página del organizador", municipal: "Agenda municipal",
  press: "Nota de prensa", instagram: "Ver en Instagram", tiktok: "Ver en TikTok", flyer: "Flyer",
};

/** Who to believe about the hour: ticketing > organizer/social > press > municipal. Placeholders always lose. */
const TIME_RANK: Record<RawEvent["sourceType"], number> = {
  ticketing: 0, platform: 1, manual: 1, tiktok: 1, instagram: 1, flyer: 1, press: 2, municipal: 3,
};
export function isPlaceholderTime(e: Pick<RawEvent, "startsAt" | "timeUnknown">): boolean {
  return !!e.timeUnknown || /T(00:00|23:59)(:\d{2})?/.test(e.startsAt);
}
function timeRank(e: RawEvent): number {
  return (TIME_RANK[e.sourceType] ?? 5) + (isPlaceholderTime(e) ? 10 : 0);
}

/** Same venue: identical normalised name, same first word, or coordinates within 150 m. */
export function sameVenue(a: RawEvent, b: RawEvent): boolean {
  const na = normalizeText(a.venueName);
  const nb = normalizeText(b.venueName);
  if (na === nb) return true;
  if (na.split(" ")[0] === nb.split(" ")[0] && na.split(" ")[0]!.length > 2) return true;
  if (a.lat !== undefined && a.lng !== undefined && b.lat !== undefined && b.lng !== undefined) {
    const dLat = (a.lat - b.lat) * 111_000;
    const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng) <= 150;
  }
  return false;
}

/** Same event announced twice with different times: same date, similar title core, same venue. */
export function looksLikeSameEvent(a: RawEvent, b: RawEvent): boolean {
  if (dateOf(a.startsAt) !== dateOf(b.startsAt)) return false;
  if (!sameVenue(a, b)) return false;
  const sim = titleSimilarity(a.title, b.title);
  if (sim >= 0.5) return true;
  // one title contained in the other ("Ivan Menna en Switch" vs "Ivan Menna open to close @ Switch Club")
  const ta = new Set(titleTokens(a.title));
  const tb = new Set(titleTokens(b.title));
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size === 0) return false;
  let inter = 0;
  for (const w of small) if (big.has(w)) inter++;
  return inter / small.size >= 0.8 && small.size >= 2;
}

export function sourceRank(t: RawEvent["sourceType"]): number {
  return SOURCE_RANK[t] ?? 9;
}
export function linkLabel(t: RawEvent["sourceType"]): string {
  return SOURCE_LABEL[t] ?? "Más info";
}

/** Every link a record carries: its sourceUrl (labelled by source type), its links, and legacy footer URLs. */
function linksOf(e: RawEvent): Link[] {
  const out: Link[] = [];
  if (e.sourceUrl) out.push({ label: linkLabel(e.sourceType), url: e.sourceUrl });
  for (const l of e.links ?? []) out.push(l);
  for (const url of splitFooter(e.description).urls) out.push({ label: "Fuente", url });
  return out;
}

/** Deduplicated by URL, primary excluded, at most MAX_LINKS. */
export function dedupeLinks(links: Link[], exclude?: string): Link[] | undefined {
  const seen = new Set<string>(exclude ? [exclude] : []);
  const out: Link[] = [];
  for (const l of links) {
    if (!l.url || seen.has(l.url)) continue;
    seen.add(l.url);
    out.push({ label: l.label.slice(0, 40), url: l.url });
    if (out.length === MAX_LINKS) break;
  }
  return out.length ? out : undefined;
}

function splitFooter(description?: string): { body: string; urls: string[] } {
  if (!description) return { body: "", urls: [] };
  const i = description.lastIndexOf(FOOTER);
  if (i < 0) return { body: description, urls: [] };
  return {
    body: description.slice(0, i),
    urls: description.slice(i + FOOTER.length).split(/\s*,\s*/).filter(Boolean),
  };
}

function richer<T>(a: T | undefined, b: T | undefined): T | undefined {
  if (a === undefined || a === null || a === "") return b;
  if (b === undefined || b === null || b === "") return a;
  if (typeof a === "string" && typeof b === "string") return b.length > a.length ? b : a;
  return a;
}

/**
 * Merge two records of the same event. `a` wins ties; longer strings win;
 * every source URL ends up in a "Fuentes:" footer of the description.
 */
export function mergeEvents<T extends RawEvent>(a: T, b: T): T {
  const fa = splitFooter(a.description);
  const fb = splitFooter(b.description);
  let description = (richer(fa.body, fb.body) ?? "").trim();
  if (description.length > MAX_DESCRIPTION) description = description.slice(0, MAX_DESCRIPTION);

  // the most official record (ticketing > platform > organizer > municipal > press > social) owns sourceUrl/sourceType/sourceName
  const primary = sourceRank(b.sourceType) < sourceRank(a.sourceType) ? b : a;
  const secondary = primary === a ? b : a;
  const links = dedupeLinks([...linksOf(primary), ...linksOf(secondary)].slice(1), primary.sourceUrl);

  const price =
    a.price && b.price
      ? {
          free: a.price.free && b.price.free,
          min: minDefined(a.price.min, b.price.min),
          max: maxDefined(a.price.max, b.price.max),
          currency: "ARS" as const,
        }
      : (a.price ?? b.price);

  // the more authoritative source decides the hour; a 00:00 / 23:59 / unknown placeholder never wins over a real time
  const timeOwner = dateOf(a.startsAt) === dateOf(b.startsAt) && timeRank(b) < timeRank(a) ? b : a;
  return {
    ...b,
    ...a,
    startsAt: timeOwner.startsAt,
    endsAt: timeOwner.endsAt ?? richer(a.endsAt, b.endsAt),
    timeUnknown: timeOwner.timeUnknown,
    recurring: a.recurring ?? b.recurring,
    rating: a.rating ?? b.rating,
    vibe: a.vibe && b.vibe ? { ...b.vibe, ...a.vibe } : (a.vibe ?? b.vibe),
    context: joinContext(a.context, b.context),
    shortTitle: a.shortTitle ?? b.shortTitle,
    title: richer(a.title, b.title) ?? a.title,
    description: description || undefined,
    address: richer(a.address, b.address),
    lat: a.lat ?? b.lat,
    lng: a.lng ?? b.lng,
    barrio: richer(a.barrio, b.barrio),
    category: a.category !== "otro" ? a.category : b.category,
    price,
    sourceType: primary.sourceUrl ? primary.sourceType : (a.sourceUrl ? a.sourceType : b.sourceUrl ? b.sourceType : a.sourceType),
    sourceName: primary.sourceName ?? secondary.sourceName,
    sourceUrl: primary.sourceUrl ?? secondary.sourceUrl,
    links,
    imageUrl: a.imageUrl ?? b.imageUrl,
    metrics: mergeMetrics(a.metrics, b.metrics),
  };
}

function mergeMetrics(a?: RawEvent["metrics"], b?: RawEvent["metrics"]): RawEvent["metrics"] {
  if (!a) return b;
  if (!b) return a;
  const views = maxDefined(a.views, b.views);
  const likes = maxDefined(a.likes, b.likes);
  return { ...(views !== undefined ? { views } : {}), ...(likes !== undefined ? { likes } : {}) };
}

/** Append a labelled snippet to an event's transient context (max 4000 chars). */
export function addContext(e: { context?: string }, label: string, text?: string | null): void {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t) return;
  const piece = `${label}: ${t}`;
  if (e.context?.includes(piece.slice(0, 80))) return;
  e.context = `${e.context ? `${e.context}\n` : ""}${piece}`.slice(0, 4000);
}
function joinContext(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a}\n${b}`.slice(0, 4000);
}

function minDefined(a?: number, b?: number) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}
function maxDefined(a?: number, b?: number) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/** Stable short hash (FNV-1a, 32 bit) rendered as 8 hex chars. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function eventId(e: Pick<RawEvent, "sourceType" | "title" | "startsAt" | "venueName">): string {
  return `${e.sourceType}-${shortHash(fingerprint(e))}`;
}

export type { Event };
