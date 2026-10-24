import type { EventCategory } from "@/lib/events/schema";

/** Newline-delimited JSON the concierge streams (api contract, 2026-10-24 14:45). */
export type PlanIntro = { type: "intro"; text: string };
export type PlanStop = {
  type: "stop";
  eventId?: string;
  time: string;
  shortTitle: string;
  venueName: string;
  barrio?: string;
  price?: string;
  why?: string;
  walkMinutes?: number;
  category?: EventCategory;
};
export type PlanOutro = { type: "outro"; text: string; shareText?: string };
export type PlanLine = PlanIntro | PlanStop | PlanOutro;

export type ParsedPlan = {
  /** "json" once the first line parsed as a plan line; "text" when the stream is plain prose; null while undecided. */
  mode: "json" | "text" | null;
  intro?: string;
  stops: PlanStop[];
  outro?: string;
  shareText?: string;
};

/** Parse whatever has streamed so far. Complete lines only; the trailing partial line is ignored until it closes. */
export function parsePlan(stream: string, done: boolean): ParsedPlan {
  const plan: ParsedPlan = { mode: null, stops: [] };
  const trimmed = stream.replace(/^\s+/, "");
  if (!trimmed) return plan;
  if (!trimmed.startsWith("{")) return { ...plan, mode: "text" };
  const lines = stream.split("\n");
  const complete = done ? lines : lines.slice(0, -1);
  for (const raw of complete) {
    const line = raw.trim();
    if (!line) continue;
    let obj: PlanLine | null = null;
    try {
      obj = JSON.parse(line) as PlanLine;
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object" || !("type" in obj)) continue;
    plan.mode = "json";
    if (obj.type === "intro") plan.intro = obj.text;
    else if (obj.type === "stop") plan.stops.push(obj);
    else if (obj.type === "outro") {
      plan.outro = obj.text;
      plan.shareText = obj.shareText;
    }
  }
  if (plan.mode === null) plan.mode = done ? "text" : null;
  return plan;
}

/** Plain-text version of a JSON plan, for WhatsApp when the API gives no shareText. */
export function planToText(plan: ParsedPlan): string {
  const lines: string[] = [];
  if (plan.intro) lines.push(plan.intro, "");
  plan.stops.forEach((s, i) => lines.push(`${i + 1}. ${s.time} · ${s.shortTitle} · ${s.venueName}${s.price ? ` · ${s.price}` : ""}`));
  if (plan.outro) lines.push("", plan.outro);
  return lines.join("\n");
}
