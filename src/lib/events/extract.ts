import { z } from "zod";
import { completeJSON, isMockMode } from "../ai";
import { EXTRACT_SYSTEM, buildCaptionPrompt, type CaptionForPrompt } from "../prompts";
import { EventCategory, RawEventSchema, type RawEvent } from "./schema";
import { epochMs, rosarioDate } from "./time";
import { fingerprint } from "./normalize";

/**
 * Turn social-media captions (TikTok / Instagram export from radar) into RawEvent[]
 * using Claude. Batches of 20 posts per request; mock mode returns a fixed sample.
 */

const BATCH_SIZE = 20;

/** One post of the radar export. Field names vary a bit between exports, so most are optional. */
export const SocialPostSchema = z.object({
  url: z.string().min(1),
  fecha: z.string().optional(),
  poi: z.union([z.string(), z.object({ name: z.string().optional(), address: z.string().optional() }).loose(), z.null()]).optional(),
  descr: z.string().optional(),
  handle: z.string().optional(),
  // aliases seen in other exports
  descripcion: z.string().optional(),
  caption: z.string().optional(),
  text: z.string().optional(),
  usuario: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
  ubicacion: z.string().optional(),
});
export type SocialPost = z.infer<typeof SocialPostSchema>;

/** What we ask the model for: a RawEvent minus the fields we fill ourselves, plus the post index. */
const ExtractedEventSchema = z.object({
  postIndex: z.number().int(),
  title: z.string(),
  description: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  venueName: z.string(),
  address: z.string().optional(),
  barrio: z.string().optional(),
  category: EventCategory,
  price: z.object({ free: z.boolean(), min: z.number().optional(), max: z.number().optional() }).optional(),
  confidence: z.number(),
});
const MIN_CONFIDENCE = 0.4;
const MAX_DAYS_AHEAD = 120;
const ExtractionSchema = z.object({ events: z.array(ExtractedEventSchema) });
type Extracted = z.infer<typeof ExtractedEventSchema>;

function captionOf(p: SocialPost): string {
  return (p.descr ?? p.descripcion ?? p.caption ?? p.text ?? "").trim();
}
function handleOf(p: SocialPost): string | undefined {
  const h = p.handle ?? p.usuario ?? p.author;
  return h ? (h.startsWith("@") ? h : `@${h}`) : undefined;
}
function poiOf(p: SocialPost): string | undefined {
  if (!p.poi) return p.ubicacion;
  if (typeof p.poi === "string") return p.poi;
  return [p.poi.name, p.poi.address].filter(Boolean).join(", ") || undefined;
}
export function sourceTypeOf(url: string): "tiktok" | "instagram" {
  return /instagram\.com/i.test(url) ? "instagram" : "tiktok";
}

function toPrompt(p: SocialPost, index: number): CaptionForPrompt {
  return { index, url: p.url, fecha: p.fecha ?? p.date ?? "(desconocida)", poi: poiOf(p), handle: handleOf(p), descr: captionOf(p) };
}

/** Attach provenance from the post and validate against the frozen contract. */
function toRaw(e: Extracted, post: SocialPost): RawEvent | undefined {
  const candidate = {
    title: e.title.slice(0, 160),
    description: e.description,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venueName,
    address: e.address,
    barrio: e.barrio,
    category: e.category,
    price: e.price ? { ...e.price, currency: "ARS" as const } : undefined,
    sourceType: sourceTypeOf(post.url),
    sourceName: handleOf(post),
    sourceUrl: post.url,
  };
  const parsed = RawEventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

export type ExtractOptions = { now?: Date; onBatch?: (done: number, total: number, found: number) => void };

/** Extract RawEvent[] from a list of posts. Posts without text are skipped. */
export async function extractEventsFromCaptions(posts: SocialPost[], opts: ExtractOptions = {}): Promise<RawEvent[]> {
  const usable = posts.filter((p) => captionOf(p).length >= 15);
  const today = rosarioDate(opts.now ?? new Date());
  const out: RawEvent[] = [];
  for (let i = 0; i < usable.length; i += BATCH_SIZE) {
    const batch = usable.slice(i, i + BATCH_SIZE);
    const events = await extractBatch(batch, today);
    out.push(...events);
    opts.onBatch?.(Math.min(i + BATCH_SIZE, usable.length), usable.length, out.length);
  }
  return out;
}

async function extractBatch(batch: SocialPost[], today: string): Promise<RawEvent[]> {
  const prompt = buildCaptionPrompt(batch.map(toPrompt), today);
  const result = await completeJSON({
    prompt,
    system: EXTRACT_SYSTEM,
    schema: ExtractionSchema,
    mock: mockExtraction(batch, today),
    maxTokens: 16000,
  });
  const out: RawEvent[] = [];
  const seen = new Set<string>();
  for (const e of result.events) {
    const post = batch[e.postIndex];
    if (!post || e.confidence < MIN_CONFIDENCE) continue;
    const raw = toRaw(e, post);
    if (!raw || !plausibleDate(raw.startsAt, today)) continue;
    const fp = fingerprint(raw);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(raw);
  }
  return out;
}

/** Not in the past, not absurdly far ahead (guards against mis-resolved years). */
function plausibleDate(startsAt: string, today: string): boolean {
  const ms = epochMs(startsAt);
  const todayMs = epochMs(today);
  return !Number.isNaN(ms) && ms >= todayMs && ms <= todayMs + MAX_DAYS_AHEAD * 86_400_000;
}

/** Mock: one plausible event for the first post of the batch (so the pipeline is testable offline). */
function mockExtraction(batch: SocialPost[], today: string): z.infer<typeof ExtractionSchema> {
  if (batch.length === 0) return { events: [] };
  return {
    events: [
      {
        postIndex: 0,
        title: "Evento de prueba leído de redes (mock)",
        description: "Generado en modo mock, sin API key.",
        startsAt: `${today}T21:00:00-03:00`,
        venueName: poiOf(batch[0]!) ?? "Bar de Pichincha",
        category: "musica",
        price: { free: true },
        confidence: 0.9,
      },
    ],
  };
}

export const __test = { captionOf, handleOf, poiOf };
export { isMockMode };
