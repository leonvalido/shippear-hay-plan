import { z } from "zod";
import { completeJSON, isMockMode } from "../ai";
import { PRICE_SYSTEM, buildPricePrompt } from "../prompts";
import type { RawEvent } from "./schema";
import { addContext } from "./normalize";

/**
 * Reads the ticket price from an event's official page: plain GET, visible text
 * (first 6,000 chars, markup stripped) -> Claude -> { free, min?, max? }.
 * Cached by URL in prices-cache.json; 200 fetches per run.
 */

export const MAX_PRICE_LOOKUPS = 200;
const MAX_TEXT = 6000;
const MIN_CONFIDENCE = 0.7;
const TICKETING = /venti\.|passline\.|ticketek\.|alpogo\.|entradauno\.|eventbrite\.|tuentrada\.|plateanet\.|livepass\./i;
const OFFICIAL_LABELS = new Set(["Entradas", "Página del evento", "Página del organizador"]);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const PriceAnswerSchema = z.object({
  free: z.boolean(),
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.literal("ARS"),
  confidence: z.number().min(0).max(1),
  note: z.string().optional(),
});
export type PriceCacheEntry = { price: RawEvent["price"] | null; confidence: number; note?: string; at: string };
export type PriceCache = Record<string, PriceCacheEntry>;

/** The page worth reading: the first official link, else a ticketing sourceUrl. */
export function officialPageOf(e: RawEvent): string | undefined {
  const first = e.links?.[0];
  if (first && OFFICIAL_LABELS.has(first.label)) return first.url;
  if (e.sourceUrl && TICKETING.test(e.sourceUrl)) return e.sourceUrl;
  return undefined;
}

/** No price, or "pago" with no amount, counts as unknown. */
export function priceUnknown(e: RawEvent): boolean {
  return !e.price || (!e.price.free && e.price.min === undefined && e.price.max === undefined);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function looksBlocked(status: number, html: string): boolean {
  return status !== 200 || /just a moment|cf-browser-verification|cf-chl|attention required|enable javascript and cookies/i.test(html.slice(0, 5000));
}

export async function fetchVisibleText(url: string, fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  try {
    const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "es-AR,es;q=0.9" } });
    const html = await res.text();
    if (looksBlocked(res.status, html)) return undefined;
    const text = stripHtml(html).slice(0, MAX_TEXT);
    return text.length >= 80 ? text : undefined;
  } catch {
    return undefined;
  }
}

export type PriceStats = { candidates: number; cached: number; fetched: number; unreadable: number; priced: number; lowConfidence: number; budgetStop: boolean };
export type PriceOptions = { onProgress?: (s: PriceStats) => void; now?: Date; fetchImpl?: typeof fetch };

/** Mutates `events`; returns counters. Mock mode applies cached prices only. */
export async function fillPrices(events: RawEvent[], cache: PriceCache, opts: PriceOptions = {}): Promise<PriceStats> {
  const stats: PriceStats = { candidates: 0, cached: 0, fetched: 0, unreadable: 0, priced: 0, lowConfidence: 0, budgetStop: false };
  const todo: { e: RawEvent; url: string }[] = [];
  for (const e of events) {
    const url = officialPageOf(e);
    if (!url || !priceUnknown(e)) continue;
    stats.candidates++;
    const hit = cache[url];
    if (hit) {
      stats.cached++;
      if (hit.price) { e.price = hit.price; stats.priced++; }
    } else todo.push({ e, url });
  }
  if (isMockMode()) return stats;

  const at = (opts.now ?? new Date()).toISOString();
  for (const { e, url } of todo) {
    if (stats.fetched >= MAX_PRICE_LOOKUPS) { stats.budgetStop = true; break; }
    stats.fetched++;
    const text = await fetchVisibleText(url, opts.fetchImpl);
    if (!text) { stats.unreadable++; cache[url] = { price: null, confidence: 0, note: "página no legible", at }; continue; }
    addContext(e, "página oficial", text.slice(0, 1500)); // also feeds the title/description/vibe pass
    const answer = await completeJSON({
      system: PRICE_SYSTEM,
      prompt: buildPricePrompt({ title: e.title, date: e.startsAt.slice(0, 10), venueName: e.venueName }, text),
      schema: PriceAnswerSchema,
      mock: { free: false, currency: "ARS", confidence: 0 },
      maxTokens: 1024,
    });
    const stated = answer.free || answer.min !== undefined || answer.max !== undefined;
    if (stated && answer.confidence >= MIN_CONFIDENCE) {
      const price: NonNullable<RawEvent["price"]> = { free: answer.free, currency: "ARS", ...(answer.min !== undefined ? { min: answer.min } : {}), ...(answer.max !== undefined ? { max: answer.max } : {}) };
      e.price = price;
      cache[url] = { price, confidence: answer.confidence, note: answer.note, at };
      stats.priced++;
    } else {
      if (stated) stats.lowConfidence++;
      cache[url] = { price: null, confidence: answer.confidence, note: answer.note, at };
    }
    if (stats.fetched % 10 === 0) opts.onProgress?.(stats);
  }
  return stats;
}
