import { NextRequest } from "next/server";
import { z } from "zod";
import { isMockMode, streamText } from "@/lib/ai";
import { sampleEvents } from "@/lib/events/sample";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * STUB (contract only). Backend session rewrites with the store and a proper prompt.
 * Request JSON: { when: "hoy"|"manana"|"finde"|ISO, lat?, lng?, budget?: number, mood?: string }
 * Response: text/plain stream (same shape as /api/generate), header x-ai-mode.
 */
const Body = z.object({
  when: z.string().default("hoy"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  budget: z.number().optional(),
  mood: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const list = sampleEvents().map((e) => `- ${e.startsAt} · ${e.title} · ${e.venueName} · ${e.price?.free ? "gratis" : "pago"}`).join("\n");
  const prompt = `Eventos disponibles:\n${list}\n\nEl usuario quiere planes para: ${parsed.data.when}. Presupuesto: ${parsed.data.budget ?? "no dijo"}. Ánimo: ${parsed.data.mood ?? "no dijo"}. Recomendá 2 o 3 con horario y por qué.`;
  return new Response(streamText({ prompt, signal: req.signal }), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "x-ai-mode": isMockMode() ? "mock" : "live" },
  });
}
