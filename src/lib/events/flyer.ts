import { z } from "zod";
import { completeJSON, isMockMode, type ImageInput } from "../ai";
import { EXTRACT_SYSTEM, buildFlyerPrompt } from "../prompts";
import { RawEventSchema, type RawEvent } from "./schema";
import { rosarioDate } from "./time";

/** Claude vision over a flyer image -> RawEvent draft + confidence. */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

const FlyerSchema = RawEventSchema.omit({ sourceType: true, sourceUrl: true, imageUrl: true, sourceName: true }).extend({
  isEvent: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type FlyerResult = { draft: RawEvent; confidence: number; mode: "mock" | "live" };

export async function readFlyer(image: ImageInput, caption?: string, now = new Date()): Promise<FlyerResult> {
  const today = rosarioDate(now);
  const r = await completeJSON({
    prompt: buildFlyerPrompt(today, caption),
    system: EXTRACT_SYSTEM,
    schema: FlyerSchema,
    image,
    mock: mockFlyer(today, caption),
    maxTokens: 4096,
  });
  const { isEvent, confidence, ...fields } = r;
  const draft: RawEvent = { ...fields, sourceType: "flyer", sourceName: "flyer" };
  return { draft, confidence: isEvent ? confidence : Math.min(confidence, 0.2), mode: isMockMode() ? "mock" : "live" };
}

function mockFlyer(today: string, caption?: string): z.infer<typeof FlyerSchema> {
  return {
    isEvent: true,
    confidence: 0.6,
    title: caption?.trim().slice(0, 60) || "Fiesta de primavera (leído del flyer, mock)",
    description: "Borrador generado en modo mock: revisá fecha, lugar y precio antes de publicar.",
    startsAt: `${today}T23:00:00-03:00`,
    venueName: "Galpón de la Música",
    address: "Estévez Boero 980, Rosario",
    barrio: "Puerto Norte",
    category: "fiesta",
    price: { free: false, min: 6000, currency: "ARS" },
  };
}

/** Accepts a data URL or bare base64; returns clean base64 and the declared type if any. */
export function splitDataUrl(s: string): { data: string; mediaType?: string } {
  const m = s.match(/^data:([\w/+.-]+);base64,(.*)$/s);
  return m ? { data: m[2]!.replace(/\s/g, ""), mediaType: m[1] } : { data: s.replace(/\s/g, "") };
}

export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export function isImageType(t: string): t is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(t);
}
