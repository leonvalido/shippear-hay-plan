import { z } from "zod";
import { completeJSON } from "../ai";
import { SHORT_TITLE_SYSTEM, buildShortTitlePrompt } from "../prompts";
import type { RawEvent } from "./schema";
import { fingerprint } from "./normalize";

/**
 * Short titles (<= 40 chars) for pins and cards, written by Claude in batches of 40.
 * `cache` maps fingerprint -> shortTitle; the caller persists it (data/private/titles-cache.json).
 * Mock mode: first 40 characters cut at a word boundary.
 */

export const MAX_SHORT = 40;
const BATCH = 40;
export type TitleCache = Record<string, string>;

const ResultSchema = z.object({ titles: z.array(z.object({ index: z.number().int(), shortTitle: z.string() })) });

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

/** Fills `shortTitle` on every event that lacks one. Mutates and returns the same array. */
export async function fillShortTitles<T extends RawEvent>(events: T[], cache: TitleCache = {}, opts: ShortTitleOptions = {}): Promise<T[]> {
  const todo: T[] = [];
  for (const e of events) {
    if (e.shortTitle) continue;
    const hit = cache[fingerprint(e)];
    if (hit) e.shortTitle = hit;
    else todo.push(e);
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const titles = await shortTitleBatch(batch);
    batch.forEach((e, idx) => {
      const t = titles[idx] ?? truncateTitle(e.title);
      e.shortTitle = t;
      cache[fingerprint(e)] = t;
    });
    opts.onBatch?.(Math.min(i + BATCH, todo.length), todo.length);
  }
  return events;
}

async function shortTitleBatch(batch: RawEvent[]): Promise<string[]> {
  const items = batch.map((e, index) => ({ index, title: e.title, venueName: e.venueName, category: e.category }));
  const result = await completeJSON({
    prompt: buildShortTitlePrompt(items),
    system: SHORT_TITLE_SYSTEM,
    schema: ResultSchema,
    mock: { titles: items.map((i) => ({ index: i.index, shortTitle: truncateTitle(i.title) })) },
    maxTokens: 8000,
  });
  const out: string[] = [];
  for (const t of result.titles) {
    const e = batch[t.index];
    if (!e) continue;
    const clean = sanitizeShort(t.shortTitle);
    out[t.index] = clean.length >= 2 && clean.length <= MAX_SHORT ? clean : truncateTitle(clean.length >= 2 ? clean : e.title);
  }
  return out;
}
