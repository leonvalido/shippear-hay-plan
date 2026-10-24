import { z } from "zod";

/**
 * THE shared contract between data ingestion, backend and web.
 * Frozen during the hackathon: change it only through the coordinator.
 * Times are ISO 8601 with offset in Rosario time (-03:00).
 */
export const EventCategory = z.enum([
  "musica", "teatro", "fiesta", "feria", "deporte", "cultura", "gastronomia", "infantil", "charla", "otro",
]);
export type EventCategory = z.infer<typeof EventCategory>;

export const SourceType = z.enum([
  "municipal", "ticketing", "platform", "press", "tiktok", "instagram", "flyer", "manual",
]);
export type SourceType = z.infer<typeof SourceType>;

export const EventStatus = z.enum(["published", "pending", "rejected"]);
export type EventStatus = z.infer<typeof EventStatus>;

export const PriceSchema = z.object({
  free: z.boolean(),
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.literal("ARS").default("ARS"),
});

export const EventSchema = z.object({
  id: z.string(),
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  startsAt: z.string(), // "2026-10-25T21:00:00-03:00"
  endsAt: z.string().optional(),
  venueName: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  barrio: z.string().optional(),
  category: EventCategory,
  price: PriceSchema.optional(),
  sourceType: SourceType,
  sourceName: z.string().optional(), // "Passline", "Municipalidad de Rosario", "@handle"
  sourceUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  /** Social-media signal for events that came from TikTok/Instagram captions. */
  metrics: z.object({ views: z.number().nonnegative().optional(), likes: z.number().nonnegative().optional() }).optional(),
  status: EventStatus.default("published"),
  fingerprint: z.string().optional(), // normalized title|date|venue, used for dedupe
  createdAt: z.string(),
});
export type Event = z.infer<typeof EventSchema>;

/** What an ingestion script or the flyer reader hands over: no id, no status yet. */
export const RawEventSchema = EventSchema.omit({ id: true, createdAt: true, status: true, fingerprint: true }).extend({
  category: EventCategory.default("otro"),
});
export type RawEvent = z.infer<typeof RawEventSchema>;

export const EventsQuerySchema = z.object({
  from: z.string().optional(), // ISO; default now
  to: z.string().optional(), // ISO; default now + 14 days
  category: EventCategory.optional(),
  q: z.string().max(100).optional(),
  bbox: z.string().optional(), // "minLng,minLat,maxLng,maxLat"
  status: EventStatus.default("published"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type EventsQuery = z.infer<typeof EventsQuerySchema>;

/** Rough bounding box of Gran Rosario, for sanity checks. */
export const ROSARIO_BBOX = { minLng: -60.85, minLat: -33.1, maxLng: -60.55, maxLat: -32.8 } as const;
export const ROSARIO_CENTER = { lat: -32.9468, lng: -60.6393 } as const;
