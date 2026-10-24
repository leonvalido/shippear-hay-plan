import { NextRequest } from "next/server";
import { z } from "zod";
import { describeError, isMockMode, streamText } from "@/lib/ai";
import { CONCIERGE_SYSTEM } from "@/lib/prompts";
import { buildConciergePrompt, mockConcierge, rankEvents, resolveWindow } from "@/lib/events/concierge";
import { getEventStore } from "@/lib/events/store";
import { toRosarioISO } from "@/lib/events/time";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/concierge  { when, lat?, lng?, budget?, mood? }
 * -> text/plain stream (rioplatense Spanish, 2-3 picks from the store), header x-ai-mode.
 */
const Body = z.object({
  when: z.string().max(60).default("hoy"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  budget: z.number().nonnegative().optional(),
  mood: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return jsonError("concierge", 400, parsed.error.issues[0]?.message ?? "Datos inválidos");
  const input = parsed.data;

  try {
    const win = resolveWindow(input.when);
    const store = await getEventStore();
    const events = store.queryEvents({ from: toRosarioISO(win.from), to: toRosarioISO(win.to), status: "published", limit: 200 });
    const ranked = rankEvents(events, input);
    const stream = streamText({
      system: CONCIERGE_SYSTEM,
      prompt: buildConciergePrompt(ranked, input, win),
      mock: mockConcierge(ranked, win),
      maxTokens: 1024,
      signal: req.signal,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "x-ai-mode": isMockMode() ? "mock" : "live",
        "x-candidates": String(ranked.length),
      },
    });
  } catch (err) {
    return jsonError("concierge", 502, describeError(err), err);
  }
}
