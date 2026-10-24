import { z } from "zod";
import type { RawEvent } from "./schema";
import { addContext, fingerprint, normalizeText } from "./normalize";
import { applyOfficialLink, hasOfficialLink } from "./officialLinks";
import { priceUnknown } from "./prices";

/**
 * Precomputed enrichments written by the analysis session into data/private/raw/:
 *  - links-prices*.json: official page + price per event fingerprint
 *  - venues-places.json: Google Places details per venue name
 * Neither is a RawEvent[]; readRawFiles skips them and build-events applies them here.
 */

export const SIDECAR_FILES = new Set(["links-prices.json", "links-prices-b.json", "venues-places.json"]);
export function isSidecar(name: string): boolean {
  return SIDECAR_FILES.has(name) || /^links-prices.*\.json$/.test(name);
}

const PriceSchema = z.object({ free: z.boolean(), min: z.number().nonnegative().optional(), max: z.number().nonnegative().optional(), currency: z.literal("ARS").default("ARS") });
export const LinkPriceRowSchema = z.object({
  fingerprint: z.string().min(1),
  officialUrl: z.string().url().nullable().optional(),
  label: z.string().nullable().optional(),
  price: PriceSchema.nullable().optional(),
  confidence: z.number().min(0).max(1).default(0),
});
export type LinkPriceRow = z.infer<typeof LinkPriceRowSchema>;

const OFFICIAL_LABELS = new Set(["Entradas", "Página del evento", "Página del organizador", "Instagram del organizador"]);
const MIN_PRICE_CONFIDENCE = 0.7;

/** Concatenated rows, deduped by fingerprint, first wins. */
export function indexLinkPrices(lists: unknown[][]): Map<string, LinkPriceRow> {
  const out = new Map<string, LinkPriceRow>();
  for (const list of lists) for (const item of list) {
    const p = LinkPriceRowSchema.safeParse(item);
    if (p.success && !out.has(p.data.fingerprint)) out.set(p.data.fingerprint, p.data);
  }
  return out;
}

export type LinkPriceStats = { matched: number; linked: number; priced: number };
export function applyLinkPrices(events: RawEvent[], index: Map<string, LinkPriceRow>): LinkPriceStats {
  const stats: LinkPriceStats = { matched: 0, linked: 0, priced: 0 };
  for (const e of events) {
    const row = index.get(fingerprint(e));
    if (!row) continue;
    stats.matched++;
    if (row.officialUrl && !hasOfficialLink(e)) {
      applyOfficialLink(e, row.officialUrl, row.label && OFFICIAL_LABELS.has(row.label) ? row.label : "Página del evento");
      stats.linked++;
    }
    if (row.price && priceUnknown(e) && row.confidence >= MIN_PRICE_CONFIDENCE) {
      e.price = row.price;
      stats.priced++;
    }
  }
  return stats;
}

export const VenuePlaceSchema = z.object({
  venueName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  matched: z.boolean().default(false),
  name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  websiteUri: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  userRatingCount: z.number().nullable().optional(),
  googleMapsUri: z.string().nullable().optional(),
  confidence: z.number().default(0),
  editorialSummary: z.string().nullable().optional(),
  reviews: z.array(z.union([z.string(), z.object({ text: z.string().optional() }).loose()])).optional(),
  primaryType: z.string().nullable().optional(),
});
export type VenuePlace = z.infer<typeof VenuePlaceSchema>;

export function indexVenues(list: unknown[]): Map<string, VenuePlace> {
  const out = new Map<string, VenuePlace>();
  for (const item of list) {
    const p = VenuePlaceSchema.safeParse(item);
    if (!p.success || !p.data.matched) continue;
    for (const n of [p.data.venueName, ...p.data.aliases]) {
      const key = normalizeText(n);
      if (key && !out.has(key)) out.set(key, p.data);
    }
  }
  return out;
}

/** 0.9 = name match (trust everything); 0.7 = address/distance only (trust location, not identity). */
const VENUE_NAME_MATCH = 0.9;
const VENUE_LOCATION_MATCH = 0.7;

export type VenueStats = { matched: number; coords: number; addresses: number; ratings: number; links: number };
export function applyVenues(events: RawEvent[], index: Map<string, VenuePlace>): VenueStats {
  const stats: VenueStats = { matched: 0, coords: 0, addresses: 0, ratings: 0, links: 0 };
  for (const e of events) {
    const v = index.get(normalizeText(e.venueName));
    if (!v || v.confidence < VENUE_LOCATION_MATCH) continue;
    stats.matched++;
    if ((e.lat === undefined || e.lng === undefined) && v.lat != null && v.lng != null) { e.lat = v.lat; e.lng = v.lng; stats.coords++; }
    if (!e.address && v.address) { e.address = v.address; stats.addresses++; }
    if (v.confidence < VENUE_NAME_MATCH) continue; // a doubtful identity must not lend its rating or website
    if (!e.rating && v.rating != null && v.userRatingCount != null) { e.rating = { value: v.rating, count: v.userRatingCount }; stats.ratings++; }
    addContext(e, "Google Places", v.editorialSummary);
    const reviews = (v.reviews ?? []).map((r) => (typeof r === "string" ? r : r.text ?? "")).filter(Boolean).slice(0, 3).join(" | ");
    addContext(e, "reseñas", reviews || undefined);
    const links = [...(e.links ?? [])];
    const has = (url: string) => links.some((l) => l.url === url) || e.sourceUrl === url;
    // "Sitio del lugar" is deliberately not an official-page label: a ticketing/event page found later still goes first
    if (v.websiteUri && !hasOfficialLink(e) && !has(v.websiteUri) && isHttp(v.websiteUri)) { links.push({ label: "Sitio del lugar", url: v.websiteUri }); stats.links++; }
    if (v.googleMapsUri && !has(v.googleMapsUri) && isHttp(v.googleMapsUri)) links.push({ label: "Ver en Google Maps", url: v.googleMapsUri });
    if (links.length !== (e.links?.length ?? 0)) e.links = links.slice(0, 6);
  }
  return stats;
}

function isHttp(u: string): boolean {
  try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; }
}
