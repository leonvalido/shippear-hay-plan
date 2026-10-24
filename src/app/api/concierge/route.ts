import { NextRequest } from "next/server";
import { z } from "zod";
import { describeError, isMockMode, streamText } from "@/lib/ai";
import { CONCIERGE_SYSTEM } from "@/lib/prompts";
import { buildConciergePrompt, mockConcierge, rankEvents, resolveWindow } from "@/lib/events/concierge";
import { getEventStore } from "@/lib/events/store";
import { toRosarioISO } from "@/lib/events/time";
import { jsonError, readJson } from "@/lib/http";
import { DAY, MINUTE, allow, clientIp, underDailyBudget } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/concierge  { when, lat?, lng?, budget?, mood? }
 * -> text/plain stream (rioplatense Spanish, 2-3 picks from the store), header x-ai-mode.
 * Limits: 10 calls / 10 min and 60 / day per IP, 2,000 / day per instance; text input <= 300 chars.
 */
const MAX_TEXT = 300;
const PER_IP = [
  { windowMs: 10 * MINUTE, max: 10 },
  { windowMs: DAY, max: 60 },
];
const DAILY_BUDGET = 2000;
const MAX_TOKENS = 1200;

const Body = z.object({
  when: z.string().max(60).default("hoy"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  budget: z.number().nonnegative().optional(),
  mood: z.string().max(MAX_TEXT, `El texto no puede superar ${MAX_TEXT} caracteres`).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return jsonError("concierge", 400, parsed.error.issues[0]?.message ?? "Datos inválidos");
  const input = parsed.data;
  if ((input.mood?.length ?? 0) + input.when.length > MAX_TEXT) {
    return jsonError("concierge", 400, `El pedido no puede superar ${MAX_TEXT} caracteres`);
  }

  const verdict = allow(`concierge:${clientIp(req.headers)}`, PER_IP);
  if (!verdict.ok) {
    console.error(`[concierge] 429 rate limit · retry in ${verdict.retryAfterSec}s`);
    return Response.json(
      { error: "Tranqui, ya armamos varios planes seguidos. Esperá un ratito y volvé a probar." },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSec) } },
    );
  }
  if (!isMockMode() && !underDailyBudget(DAILY_BUDGET)) {
    return jsonError("concierge", 503, "El conserje se tomó el día: llegamos al cupo de hoy. Mañana volvemos con más planes.");
  }

  try {
    const win = resolveWindow(input.when);
    const store = await getEventStore();
    const events = store.queryEvents({ from: toRosarioISO(win.from), to: toRosarioISO(win.to), status: "published", limit: 200 });
    const ranked = rankEvents(events, input);
    const stream = streamText({
      system: CONCIERGE_SYSTEM,
      prompt: buildConciergePrompt(ranked, input, win),
      mock: mockConcierge(ranked, win),
      maxTokens: MAX_TOKENS,
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
