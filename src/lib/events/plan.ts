import { z } from "zod";
import { completeJSON, isMockMode } from "../ai";
import { CONCIERGE_JSON_SYSTEM, buildConciergeJsonPrompt } from "../prompts";
import type { Event } from "./schema";
import { alreadyStarted, detectIntent, hourLabel, priceLabel, vibeLabel, whenLabel, type ConciergeInput, type Intent, type Ranked, type Window } from "./concierge";

/**
 * Structured plan for POST /api/concierge (NDJSON). Claude picks event ids and
 * writes intro / why / outro; every stop is re-hydrated from the store so times,
 * venues and prices are always real.
 */

const PlanSchema = z.object({
  intro: z.string(),
  stops: z.array(z.object({ eventId: z.string(), why: z.string() })).max(3),
  outro: z.string(),
});

export type PlanStop = {
  type: "stop";
  eventId: string;
  time: string; // "21:00" or "dom 16:00" or "abre a las 00:00" / "horario a confirmar"
  startsAt: string;
  shortTitle: string;
  title: string;
  venueName: string;
  barrio?: string;
  price?: string; // absent when the source gave no price (no pill)
  vibe?: string; // "electrónica y house · público 25-35"
  why: string;
  started?: boolean; // began within the last 60 minutes: "ya empezó, todavía llegás"
  walkMinutes?: number;
  lat?: number;
  lng?: number;
};
export type PlanIntro = { type: "intro"; text: string };
export type PlanOutro = { type: "outro"; text: string; shareText: string };
export type PlanLine = PlanIntro | PlanStop | PlanOutro;

const WALK_M_PER_MIN = 80;
export const FOOTER = "Plan armado con HayPlan";

function stopFrom(e: Event, why: string, km?: number, firstDay?: string, now = new Date()): PlanStop {
  const h = hourLabel(e.startsAt);
  const sameDay = !firstDay || e.startsAt.slice(0, 10) === firstDay;
  const time = e.timeUnknown ? "horario a confirmar" : e.recurring ? `abre a las ${h.slice(-5)}` : sameDay ? h.slice(-5) : `${h.slice(0, 3)} ${h.slice(-5)}`;
  return {
    type: "stop",
    eventId: e.id,
    time,
    startsAt: e.startsAt,
    shortTitle: e.shortTitle ?? e.title,
    title: e.title,
    venueName: e.venueName,
    ...(e.barrio ? { barrio: e.barrio } : {}),
    ...(e.price ? { price: priceLabel(e) } : {}),
    ...(vibeLabel(e) ? { vibe: vibeLabel(e) } : {}),
    why: why.trim(),
    ...(alreadyStarted(e, now) ? { started: true } : {}),
    ...(km !== undefined ? { walkMinutes: Math.max(1, Math.round((km * 1000) / WALK_M_PER_MIN)) } : {}),
    ...(e.lat !== undefined ? { lat: e.lat } : {}),
    ...(e.lng !== undefined ? { lng: e.lng } : {}),
  };
}

export function shareText(intro: string, stops: PlanStop[], outro: string, mapUrl: string): string {
  const lines = stops.map((s) => `${s.time} · ${s.shortTitle} · ${s.venueName}${s.price ? ` · ${s.price}` : ""}${s.started ? " · ya empezó, todavía llegás" : ""}`);
  return [intro, "", ...lines, "", outro, `${FOOTER} · ${mapUrl}`].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

function candidatesText(ranked: Ranked[]): string {
  return ranked
    .map(({ event: e, km }) => {
      const parts = [e.id, e.shortTitle ?? e.title, `${e.venueName}${e.barrio ? ` (${e.barrio})` : ""}`, whenLabel(e), priceLabel(e), e.category];
      if (km !== undefined) parts.push(km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
      if (e.recurring) parts.push("noche fija");
      if (alreadyStarted(e)) parts.push("ya empezó, todavía se llega");
      if (e.rating) parts.push(`puntaje ${e.rating.value}`);
      const vibe = vibeLabel(e);
      if (vibe) parts.push(`onda: ${vibe}`);
      return `- ${parts.join(" · ")}`;
    })
    .join("\n");
}

function mockPlan(ranked: Ranked[], win: Window): z.infer<typeof PlanSchema> {
  if (ranked.length === 0) return { intro: `Para ${win.label} no tengo nada cargado todavía.`, stops: [], outro: "Probá con otro día o ampliá la zona.", };
  const picks = distinctByTitle(ranked).slice(0, 3).sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  return {
    intro: `Plan para ${win.label} (modo demo, sin API key):`,
    stops: picks.map(({ event: e }) => ({ eventId: e.id, why: vibeLabel(e) ? `${vibeLabel(e)}: va con lo que pediste.` : `Va bien si querés algo de ${e.category}.` })),
    outro: "Entre parada y parada, a pata o en bici: todo queda cerca.",
  };
}

/** One candidate per show: the same title on several dates/sources should not fill the whole plan. */
function distinctByTitle(ranked: Ranked[]): Ranked[] {
  const seen = new Set<string>();
  return ranked.filter((r) => {
    const key = (r.event.shortTitle ?? r.event.title).toLowerCase();
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

/** Builds the plan lines. Stops that do not match a candidate id or repeat a title are dropped. */
export async function buildPlan(ranked: Ranked[], input: ConciergeInput, win: Window, mapUrl: string, now = new Date(), intent: Intent = detectIntent(input.mood, input.when)): Promise<PlanLine[]> {
  const near = input.lat !== undefined ? "cerca de su ubicación" : undefined;
  const plan = await completeJSON({
    system: CONCIERGE_JSON_SYSTEM,
    prompt: buildConciergeJsonPrompt(candidatesText(ranked), win.label, hourLabel(now.toISOString()), input.budget, input.mood, near, intent.label),
    schema: PlanSchema,
    mock: mockPlan(ranked, win),
    maxTokens: 1200,
  });
  const byId = new Map(ranked.map((r) => [r.event.id, r] as const));
  const chosen: { r: Ranked; why: string }[] = [];
  for (const s of plan.stops) {
    const r = byId.get(s.eventId);
    const title = r ? (r.event.shortTitle ?? r.event.title).toLowerCase() : "";
    if (r && !chosen.some((c) => c.r.event.id === r.event.id || (c.r.event.shortTitle ?? c.r.event.title).toLowerCase() === title)) chosen.push({ r, why: s.why });
  }
  chosen.sort((a, b) => a.r.event.startsAt.localeCompare(b.r.event.startsAt));
  const firstDay = chosen[0]?.r.event.startsAt.slice(0, 10);
  const stops = chosen.map(({ r, why }) => stopFrom(r.event, why, r.km, firstDay, now));
  const intro = plan.intro.trim();
  const outro = plan.outro.trim();
  return [{ type: "intro", text: intro }, ...stops, { type: "outro", text: outro, shareText: shareText(intro, stops, outro, mapUrl) }];
}

export { isMockMode };
