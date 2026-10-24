import { NextRequest } from "next/server";
import type { RawEvent } from "@/lib/events/schema";

export const runtime = "nodejs";

/**
 * STUB (contract only). Backend session implements Claude vision here.
 * Request: multipart/form-data with `image` (jpeg/png/webp, <= 5 MB) and optional `caption` text,
 *          OR JSON { imageBase64, mediaType, caption? }.
 * Response: { draft: RawEvent, confidence: number (0..1), duplicates: Event[], mode: "mock"|"live" }
 */
export async function POST(_req: NextRequest) {
  const draft: RawEvent = {
    title: "Evento leído del flyer (mock)",
    startsAt: "2026-10-25T21:00:00-03:00",
    venueName: "Lugar del flyer",
    category: "otro",
    sourceType: "flyer",
    price: { free: false, currency: "ARS" },
  };
  return Response.json({ draft, confidence: 0.5, duplicates: [], mode: "mock" });
}
