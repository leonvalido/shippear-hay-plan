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
  const body = (richer(fa.body, fb.body) ?? "").trim();
  const urls = [...new Set([...fa.urls, ...fb.urls, a.sourceUrl, b.sourceUrl].filter((u): u is string => !!u))];
  let description = urls.length ? `${body}${FOOTER}${urls.join(", ")}`.trim() : body;
  if (description.length > MAX_DESCRIPTION) description = description.slice(0, MAX_DESCRIPTION);

  const price =
    a.price && b.price
      ? {
          free: a.price.free && b.price.free,
          min: minDefined(a.price.min, b.price.min),
          max: maxDefined(a.price.max, b.price.max),
          currency: "ARS" as const,
        }
      : (a.price ?? b.price);

  return {
    ...b,
    ...a,
    title: richer(a.title, b.title) ?? a.title,
    description: description || undefined,
    endsAt: richer(a.endsAt, b.endsAt),
    address: richer(a.address, b.address),
    lat: a.lat ?? b.lat,
    lng: a.lng ?? b.lng,
    barrio: richer(a.barrio, b.barrio),
    category: a.category !== "otro" ? a.category : b.category,
    price,
    sourceName: richer(a.sourceName, b.sourceName),
    sourceUrl: a.sourceUrl ?? b.sourceUrl,
    imageUrl: a.imageUrl ?? b.imageUrl,
  };
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
