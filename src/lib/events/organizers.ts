import { z } from "zod";
import type { RawEvent } from "./schema";
import { normalizeText, titleSimilarity } from "./normalize";

/**
 * data/private/organizadores-rosario.json: venues and producers of Rosario with
 * their TikTok / Instagram handles. Used to spell venues one way (so duplicates
 * merge) and to replace a bare @handle in sourceName with the proper name.
 */

export const OrganizerSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.string().optional().nullable(),
  tt_handle: z.string().optional().nullable(),
  ig_handle: z.string().optional().nullable(),
  alias: z.array(z.string()).optional().nullable(),
});
export type Organizer = z.infer<typeof OrganizerSchema>;

const VENUE_TYPES = new Set(["bar/boliche", "teatro", "venue", "club", "sala", "centro cultural", "estadio", "anfiteatro", "espacio", "salón", "museo", "shopping", "mercado"]);

export class OrganizerIndex {
  private byHandle = new Map<string, Organizer>();
  private byName = new Map<string, Organizer>();
  readonly size: number;

  constructor(list: Organizer[]) {
    for (const o of list) {
      for (const h of [o.tt_handle, o.ig_handle]) if (h) this.byHandle.set(cleanHandle(h), o);
      for (const n of [o.nombre, ...(o.alias ?? [])]) this.byName.set(normalizeText(n), o);
    }
    this.size = list.length;
  }

  static fromJson(data: unknown): OrganizerIndex {
    const list = Array.isArray(data) ? data : [];
    const out: Organizer[] = [];
    for (const item of list) {
      const p = OrganizerSchema.safeParse(item);
      if (p.success) out.push(p.data);
    }
    return new OrganizerIndex(out);
  }

  byHandleOf(handle?: string): Organizer | undefined {
    return handle ? this.byHandle.get(cleanHandle(handle)) : undefined;
  }

  /** Exact (normalised) or alias match first, then a fuzzy match on significant words. */
  byVenueName(name: string): Organizer | undefined {
    const key = normalizeText(name);
    const exact = this.byName.get(key);
    if (exact) return exact;
    let best: { o: Organizer; score: number } | undefined;
    for (const [n, o] of this.byName) {
      const score = titleSimilarity(n, key);
      if (score >= 0.75 && (!best || score > best.score)) best = { o, score };
    }
    return best?.o;
  }

  /** Mutates: canonical venueName, proper sourceName for a known handle. Returns what changed. */
  apply(e: RawEvent): { venue: boolean; source: boolean } {
    const changed = { venue: false, source: false };
    const venueMatch = this.byVenueName(e.venueName);
    if (venueMatch && venueMatch.nombre !== e.venueName) { e.venueName = venueMatch.nombre; changed.venue = true; }

    const handleMatch = this.byHandleOf(e.sourceName);
    if (handleMatch) {
      if (e.sourceName !== handleMatch.nombre) { e.sourceName = handleMatch.nombre; changed.source = true; }
      const bareVenue = !venueMatch && (normalizeText(e.venueName) === "rosario" || normalizeText(e.venueName) === normalizeText(cleanHandle(e.sourceName ?? "")));
      if (bareVenue && VENUE_TYPES.has(handleMatch.tipo ?? "")) { e.venueName = handleMatch.nombre; changed.venue = true; }
    }
    return changed;
  }
}

export function cleanHandle(h: string): string {
  return h.trim().replace(/^@/, "").toLowerCase();
}
