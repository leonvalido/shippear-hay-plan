import { z } from "zod";
import { completeWithWebSearch, isMockMode } from "../ai";
import { OFFICIAL_LINK_SYSTEM, buildOfficialLinkPrompt, type OfficialLookupItem } from "../prompts";
import type { RawEvent } from "./schema";
import { fingerprint, linkLabel, type Link } from "./normalize";

/**
 * Finds the official page (tickets > venue/organizer page > organizer's Instagram post)
 * for events we only know from a press article, the municipal agenda or a social post.
 * Claude searches the web (web_search tool, 3 searches per call, 10 events per call);
 * every URL is checked for a 200 and must sit on a different domain than the source.
 * Results, including "nothing found", are cached by fingerprint in links-cache.json.
 */

export const LOOKUP_SOURCES = new Set<RawEvent["sourceType"]>(["press", "municipal", "tiktok", "instagram"]);
export const BATCH = 10;
export const MAX_LOOKUPS_PER_RUN = 200;
const TICKETING = /venti\.|passline\.|ticketek\.|alpogo\.|entradauno\.|eventbrite\.|tuentrada\.|plateanet\.|livepass\./i;
const OFFICIAL_LABELS = new Set(["Entradas", "Página del evento", "Página del organizador", "Instagram del organizador"]);
const BLOCKED = /google\.|bing\.|facebook\.com\/search|duckduckgo\./i;

export type LinkCacheEntry = { officialUrl: string | null; label?: string; at: string };
export type LinkCache = Record<string, LinkCacheEntry>;

const AnswerSchema = z.array(z.object({ fingerprint: z.string(), officialUrl: z.string().nullable(), label: z.string().nullable().optional() }));

export function domainOf(url?: string): string {
  try { return url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
}

/** Already points at tickets or an organizer page, through sourceUrl or links. */
export function hasOfficialLink(e: RawEvent): boolean {
  if (e.sourceUrl && TICKETING.test(e.sourceUrl)) return true;
  return (e.links ?? []).some((l) => OFFICIAL_LABELS.has(l.label) || TICKETING.test(l.url));
}

export function needsLookup(e: RawEvent): boolean {
  return LOOKUP_SOURCES.has(e.sourceType) && !!e.sourceUrl && !hasOfficialLink(e);
}

/** Label of the press/municipal/social link once it is demoted to second place. */
function sourceLinkLabel(e: RawEvent): string {
  if (e.sourceType === "press") return `Nota en ${e.sourceName ?? domainOf(e.sourceUrl)}`.slice(0, 40);
  return linkLabel(e.sourceType);
}

/** Official page first, the original source second, the rest after; max 6, no duplicates. */
export function applyOfficialLink(e: RawEvent, officialUrl: string, label: string): void {
  const ordered: Link[] = [{ label, url: officialUrl }];
  if (e.sourceUrl) ordered.push({ label: sourceLinkLabel(e), url: e.sourceUrl });
  for (const l of e.links ?? []) ordered.push(l);
  const seen = new Set<string>();
  e.links = ordered.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true))).slice(0, 6);
}

export async function urlIsLive(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetchImpl(url, { method, redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 HayPlan/1.0" } });
      if (res.status === 200) return true;
      if (method === "HEAD" && (res.status === 405 || res.status === 403 || res.status === 404)) continue;
      return false;
    } catch {
      if (method === "GET") return false;
    }
  }
  return false;
}

function parseAnswer(text: string): z.infer<typeof AnswerSchema> {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = AnswerSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function acceptable(url: string | null, sourceDomain: string): url is string {
  if (!url || !/^https?:\/\//i.test(url) || BLOCKED.test(url)) return false;
  const d = domainOf(url);
  return !!d && d !== sourceDomain && !d.endsWith(`.${sourceDomain}`) && !sourceDomain.endsWith(`.${d}`);
}

export type OfficialLinkStats = { candidates: number; cached: number; lookedUp: number; found: number; rejected: number; budgetStop: boolean };
export type OfficialLinkOptions = { onBatch?: (s: OfficialLinkStats) => void; now?: Date; fetchImpl?: typeof fetch };

/** Mutates `events`; returns counters. Mock mode only applies cached hits. */
export async function fillOfficialLinks(events: RawEvent[], cache: LinkCache, opts: OfficialLinkOptions = {}): Promise<OfficialLinkStats> {
  const stats: OfficialLinkStats = { candidates: 0, cached: 0, lookedUp: 0, found: 0, rejected: 0, budgetStop: false };
  const todo: RawEvent[] = [];
  for (const e of events) {
    if (!needsLookup(e)) continue;
    stats.candidates++;
    const hit = cache[fingerprint(e)];
    if (hit) {
      stats.cached++;
      if (hit.officialUrl) applyOfficialLink(e, hit.officialUrl, hit.label ?? "Página del evento");
    } else todo.push(e);
  }
  if (isMockMode()) return stats;

  const at = (opts.now ?? new Date()).toISOString();
  for (let i = 0; i < todo.length; i += BATCH) {
    if (stats.lookedUp >= MAX_LOOKUPS_PER_RUN) { stats.budgetStop = true; break; }
    const batch = todo.slice(i, i + BATCH);
    const byFp = new Map(batch.map((e) => [fingerprint(e), e] as const));
    const items: OfficialLookupItem[] = batch.map((e) => ({
      fingerprint: fingerprint(e), title: e.title, date: e.startsAt.slice(0, 10), venueName: e.venueName, sourceDomain: domainOf(e.sourceUrl), sourceName: e.sourceName,
    }));
    const text = await completeWithWebSearch({ system: OFFICIAL_LINK_SYSTEM, prompt: buildOfficialLinkPrompt(items), mock: "[]", maxUses: 3 });
    const answers = new Map(parseAnswer(text).map((a) => [a.fingerprint, a] as const));
    for (const [fp, e] of byFp) {
      stats.lookedUp++;
      const a = answers.get(fp);
      const label = a?.label && OFFICIAL_LABELS.has(a.label) ? a.label : "Página del evento";
      let url: string | null = null;
      if (a && acceptable(a.officialUrl, domainOf(e.sourceUrl))) {
        if (await urlIsLive(a.officialUrl, opts.fetchImpl)) url = a.officialUrl;
        else stats.rejected++;
      } else if (a?.officialUrl) stats.rejected++;
      cache[fp] = { officialUrl: url, ...(url ? { label } : {}), at };
      if (url) { applyOfficialLink(e, url, label); stats.found++; }
    }
    opts.onBatch?.(stats);
  }
  return stats;
}
