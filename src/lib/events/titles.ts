import { z } from "zod";
import { completeJSON } from "../ai";
import { isMockMode } from "../ai";
import { SHORT_TITLE_SYSTEM, buildShortTitlePrompt, type ShortTextItem } from "../prompts";
import type { RawEvent } from "./schema";
import { fingerprint } from "./normalize";

/**
 * Short titles (<= 40 chars) and, where missing or thin, two-sentence descriptions
 * for pins and cards, written by Claude in one batched call (40 events per request).
 * `cache` maps fingerprint -> { shortTitle, description? }; the caller persists it
 * (data/private/titles-cache.json). Old caches with plain strings still load.
 * Mock mode: title cut at a word boundary, description left as is.
 */

export const MAX_SHORT = 40;
export const MIN_DESCRIPTION = 80;
const MAX_DESCRIPTION = 400;
const BATCH = 40;
/** Bump when the prompt changes so every title regenerates on the next run. */
export const TITLE_VERSION = 2;
export type TitleEntry = { v?: number; shortTitle: string; description?: string };
export type TitleCache = Record<string, TitleEntry | string>;

const ResultSchema = z.object({
  titles: z.array(z.object({ index: z.number().int(), shortTitle: z.string(), description: z.string() })),
});

const FOOTER = "\n\nFuentes: ";

/** Description body without the "Fuentes:" footer mergeEvents appends. */
function splitDescription(d?: string): { body: string; footer: string } {
  if (!d) return { body: "", footer: "" };
  const i = d.lastIndexOf(FOOTER);
  return i < 0 ? { body: d, footer: "" } : { body: d.slice(0, i), footer: d.slice(i) };
}

function needsDescription(e: RawEvent): boolean {
  return !isMockMode() && splitDescription(e.description).body.trim().length < MIN_DESCRIPTION;
}

/** Only entries written by the current prompt version count as hits. */
function entryOf(v: TitleEntry | string | undefined): TitleEntry | undefined {
  return v !== undefined && typeof v === "object" && v.v === TITLE_VERSION ? v : undefined;
}

function applyDescription(e: RawEvent, description: string) {
  const { footer } = splitDescription(e.description);
  e.description = (description + footer).slice(0, 2000);
}

/** Deterministic fallback: cut at a word boundary, strip quotes. */
export function truncateTitle(title: string, max = MAX_SHORT): string {
  const clean = sanitizeShort(title);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  const words = (space > max * 0.5 ? cut.slice(0, space) : clean.slice(0, max)).replace(/[\s,:;.\-–—]+$/, "").split(" ");
  while (words.length > 1 && TRAILING.has(words[words.length - 1]!.toLowerCase())) words.pop();
  return words.join(" ").replace(/[\s,:;.\-–—]+$/, "");
}
/** Words a truncated title must not end with. */
const TRAILING = new Set(["a", "al", "con", "de", "del", "el", "en", "la", "las", "lo", "los", "para", "por", "y", "e", "o", "u", "un", "una", "su", "sus", "que"]);

function sanitizeShort(s: string): string {
  return s.replace(/["“”«»']/g, "").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
}

export type ShortTitleOptions = { onBatch?: (done: number, total: number) => void };

/**
 * Fills `shortTitle` on every event that lacks one and, in live mode, `description`
 * on events whose description is missing or shorter than 80 characters.
 * Mutates and returns the same array.
 */
export async function fillShortTitles<T extends RawEvent>(events: T[], cache: TitleCache = {}, opts: ShortTitleOptions = {}): Promise<T[]> {
  const todo: T[] = [];
  for (const e of events) {
    const hit = entryOf(cache[fingerprint(e)]);
    if (hit && !e.shortTitle) e.shortTitle = hit.shortTitle;
    if (hit?.description && needsDescription(e)) applyDescription(e, hit.description);
    if (!e.shortTitle || needsDescription(e)) todo.push(e);
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const entries = await shortTextBatch(batch);
    batch.forEach((e, idx) => {
      const entry = entries[idx] ?? { shortTitle: truncateTitle(e.title) };
      if (!e.shortTitle) e.shortTitle = entry.shortTitle;
      if (entry.description && needsDescription(e)) applyDescription(e, entry.description);
      cache[fingerprint(e)] = { v: TITLE_VERSION, shortTitle: e.shortTitle ?? entry.shortTitle, ...(entry.description ? { description: entry.description } : {}) };
    });
    opts.onBatch?.(Math.min(i + BATCH, todo.length), todo.length);
  }
  return events;
}

function priceText(e: RawEvent): string | undefined {
  if (!e.price) return undefined;
  if (e.price.free) return "gratis";
  if (e.price.min !== undefined) return `desde $${e.price.min}${e.price.max !== undefined ? ` hasta $${e.price.max}` : ""}`;
  return "pago";
}

async function shortTextBatch(batch: RawEvent[]): Promise<(TitleEntry | undefined)[]> {
  const items: ShortTextItem[] = batch.map((e, index) => ({
    index,
    title: e.title,
    venueName: e.venueName,
    category: e.category,
    price: priceText(e),
    snippet: splitDescription(e.description).body.trim().slice(0, 300) || undefined,
    needsDescription: needsDescription(e),
  }));
  const result = await completeJSON({
    prompt: buildShortTitlePrompt(items),
    system: SHORT_TITLE_SYSTEM,
    schema: ResultSchema,
    mock: { titles: items.map((i) => ({ index: i.index, shortTitle: truncateTitle(i.title), description: "" })) },
    maxTokens: 16000,
  });
  const out: (TitleEntry | undefined)[] = [];
  for (const t of result.titles) {
    const e = batch[t.index];
    if (!e) continue;
    const clean = sanitizeShort(t.shortTitle);
    const shortTitle = clean.length >= 2 && clean.length <= MAX_SHORT ? clean : truncateTitle(clean.length >= 2 ? clean : e.title);
    const description = cleanDescription(t.description);
    out[t.index] = { shortTitle, ...(description ? { description } : {}) };
  }
  return out;
}

function cleanDescription(d: string): string | undefined {
  const text = d.replace(/\s+/g, " ").trim();
  if (text.length < 20) return undefined;
  return text.length > MAX_DESCRIPTION ? text.slice(0, MAX_DESCRIPTION).replace(/\s\S*$/, "") : text;
}
