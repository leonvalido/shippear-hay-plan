import type { Event, EventCategory } from "./schema";
import { ROSARIO_CENTER } from "./schema";
import { addDays, parseInstant, startOfRosarioDay } from "./time";

/** Time windows, ranking and prompt text for the concierge. Pure functions. */

export type ConciergeInput = { when: string; lat?: number; lng?: number; budget?: number; mood?: string };

/** What the user is after, read from the free text before retrieval. */
export type Intent = {
  categories?: Set<EventCategory>;
  night?: boolean; // boliche / bailar: only from 22:00 on (or recurring nights), rated clubs first
  freeOnly?: boolean;
  previa?: boolean; // they asked for a plan: allow one earlier stop
  label?: string; // human description for the prompt
};

const NIGHT_RE = /\b(boliche|boliches|bolich\w*|bailar|baile|fiesta|fiestas|electr[oó]nica|techno|house|dj|djs|previa|after|joda|salir de noche|noche de joda|reggaet[oó]n|cumbia|perreo)\b/;
const CATEGORY_RES: [EventCategory, RegExp][] = [
  ["teatro", /\b(teatro|obra|obras|stand ?up|comedia|mon[oó]logo|impro)\b/],
  ["feria", /\b(feria|ferias|mercado|mercados|bazar|dise[nñ]o|emprendedores)\b/],
  ["infantil", /\b(chicos|chicas|ni[nñ]os|ni[nñ]as|nenes|nenas|infantil|peques|familia|familiar)\b/],
  ["musica", /\b(recital|recitales|show en vivo|banda|bandas|en vivo|concierto|m[uú]sica|rock|jazz|tango|folklore|folclore)\b/],
  ["charla", /\b(charla|charlas|taller|talleres|curso|workshop|conferencia)\b/],
  ["cultura", /\b(cine|pel[ií]cula|muestra|museo|exposici[oó]n|arte|libro|libros|poes[ií]a)\b/],
  ["gastronomia", /\b(comer|cena|cenar|gastron[oó]m\w*|food|cerveza|birra|vino|brunch)\b/],
  ["deporte", /\b(correr|carrera|marat[oó]n|partido|deporte|yoga|bici)\b/],
];

export function detectIntent(mood?: string, when?: string): Intent {
  const text = normalize(`${mood ?? ""} ${when ?? ""}`);
  const intent: Intent = {};
  const cats = new Set<EventCategory>();
  if (NIGHT_RE.test(text)) { intent.night = true; cats.add("fiesta"); cats.add("musica"); }
  for (const [cat, re] of CATEGORY_RES) if (re.test(text)) cats.add(cat);
  if (cats.size) intent.categories = cats;
  if (/\b(gratis|gratuito|sin plata|free|sin gastar|barato)\b/.test(text)) intent.freeOnly = true;
  if (/\b(plan|previa|primero|despu[eé]s|arrancar|terminar)\b/.test(text)) intent.previa = true;
  const labels = [intent.night ? "salir de noche (boliche o fiesta, de 22:00 en adelante)" : "", ...[...cats].filter((c) => !(intent.night && (c === "fiesta" || c === "musica"))), intent.freeOnly ? "gratis" : ""].filter(Boolean);
  if (labels.length) intent.label = labels.join(", ");
  return intent;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Local hour in Rosario, 0-23. */
export function rosarioHour(iso: string): number {
  const d = parseInstant(iso);
  return d ? new Date(d.getTime() - 3 * 3_600_000).getUTCHours() : 12;
}

/** True when the event fits the intent; events that contradict it never reach the model. */
export function matchesIntent(e: Event, intent: Intent, now = new Date()): boolean {
  if (intent.freeOnly && !e.price?.free) return false;
  if (intent.categories && !intent.categories.has(e.category)) return false;
  if (intent.night) {
    const h = rosarioHour(e.startsAt);
    const late = h >= 22 || h < 6 || !!e.recurring;
    const previaOk = intent.previa && h >= 20 && (e.category === "fiesta" || e.category === "musica" || e.category === "gastronomia");
    if (!late && !previaOk) return false;
    if (e.timeUnknown) return false; // "horario a confirmar" is no answer for "¿boliches esta noche?"
  }
  void now;
  return true;
}
export type Window = { from: Date; to: Date; label: string };

const DAY = 86_400_000;
const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "hoy" | "manana"/"mañana" | "finde" | "semana" | ISO date -> [from, to]. */
export function resolveWindow(when: string, now = new Date(), night = false): Window {
  const w = when.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const today = startOfRosarioDay(now);
  const endOfToday = new Date(today.getTime() + DAY + 4 * 3_600_000); // until 04:00 next day
  // a night out runs past midnight: "hoy" and "finde" reach 06:00 of the next calendar day
  const nightEnd = night ? 6 : 4;
  const endOfTonight = new Date(today.getTime() + DAY + nightEnd * 3_600_000);
  if (w === "" || w === "hoy" || w === "ahora" || w === "esta noche" || w === "hoy a la noche") return { from: now, to: endOfTonight, label: w.includes("noche") ? "esta noche" : "hoy" };
  if (w === "manana") return { from: addDays(today, 1), to: addDays(endOfTonight, 1), label: "mañana" };
  if (w === "finde" || w === "fin de semana") {
    const dow = rosarioDow(now); // 0 = domingo
    const daysToFriday = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
    const friday = addDays(today, daysToFriday);
    const from = daysToFriday <= 0 ? now : new Date(friday.getTime() + 17 * 3_600_000);
    return { from, to: new Date(addDays(friday, 3).getTime() + nightEnd * 3_600_000), label: "el finde" };
  }
  if (w === "semana" || w === "esta semana") return { from: now, to: addDays(today, 7), label: "esta semana" };
  const d = parseInstant(when);
  if (d) {
    const start = startOfRosarioDay(d);
    return { from: d.getTime() > now.getTime() ? d : now, to: new Date(start.getTime() + DAY + 4 * 3_600_000), label: `el ${DAYS_ES[rosarioDow(d)]} ${when.slice(0, 10)}` };
  }
  return { from: now, to: addDays(now, 3), label: when.slice(0, 40) };
}

function rosarioDow(d: Date): number {
  return new Date(d.getTime() - 3 * 3_600_000).getUTCDay();
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type Ranked = { event: Event; km?: number };

/** Filter by budget and intent, rank (night: recurring first, then rating; else distance, then time), keep the best `max`. */
export function rankEvents(events: Event[], input: ConciergeInput, max = 12, intent: Intent = detectIntent(input.mood, input.when)): Ranked[] {
  const here = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;
  const ranked = events
    .filter((e) => input.budget === undefined || !e.price || e.price.free || (e.price.min ?? 0) <= input.budget)
    .filter((e) => matchesIntent(e, intent))
    .map((event) => ({ event, km: here && event.lat !== undefined && event.lng !== undefined ? distanceKm(here, { lat: event.lat, lng: event.lng }) : undefined }));
  const byDistance = (a: Ranked, b: Ranked) => (a.km ?? 99) - (b.km ?? 99) || a.event.startsAt.localeCompare(b.event.startsAt);
  const byNight = (a: Ranked, b: Ranked) =>
    Number(!!b.event.recurring) - Number(!!a.event.recurring) ||
    (b.event.rating?.value ?? 0) - (a.event.rating?.value ?? 0) ||
    byDistance(a, b);
  return ranked.sort(intent.night ? byNight : byDistance).slice(0, max);
}

/** "electrónica y house · público 25-35" for prompts and reasons. */
export function vibeLabel(e: Pick<Event, "vibe">): string | undefined {
  const parts = [e.vibe?.music, e.vibe?.crowd].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export function priceLabel(e: Event): string {
  if (!e.price) return "precio no informado";
  if (e.price.free) return "gratis";
  if (e.price.min !== undefined) return `$ desde ${e.price.min.toLocaleString("es-AR")}`;
  return "pago";
}

/** Hour for the plan line; "horario a confirmar" when the source had no time. */
export function whenLabel(e: Pick<Event, "startsAt" | "timeUnknown" | "recurring">): string {
  const h = hourLabel(e.startsAt);
  if (e.timeUnknown) return `${h.slice(0, -5)}horario a confirmar`;
  return e.recurring ? `abre a las ${h.slice(-5)} (noche fija)` : h;
}

export function hourLabel(iso: string): string {
  const d = parseInstant(iso);
  if (!d) return iso;
  const local = new Date(d.getTime() - 3 * 3_600_000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${DAYS_ES[local.getUTCDay()]} ${hh}:${mm}`;
}

export function buildConciergePrompt(ranked: Ranked[], input: ConciergeInput, win: Window, now = new Date(), intent: Intent = detectIntent(input.mood, input.when)): string {
  const list = ranked.length
    ? ranked
        .map(({ event: e, km }, i) => {
          const parts = [`${i + 1}. ${e.shortTitle ?? e.title}`, `lugar: ${e.venueName}${e.barrio ? ` (${e.barrio})` : ""}`, `cuándo: ${whenLabel(e)}`, `precio: ${priceLabel(e)}`, `categoría: ${e.category}`];
          if (km !== undefined) parts.push(`distancia: ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}`);
          if (e.rating) parts.push(`puntaje: ${e.rating.value} (${e.rating.count} reseñas)`);
          const vibe = vibeLabel(e);
          if (vibe) parts.push(`onda: ${vibe}`);
          if (e.description) parts.push(`detalle: ${e.description.split("\n\nFuentes:")[0]!.slice(0, 200)}`);
          return parts.join(" · ");
        })
        .join("\n")
    : "(no hay eventos en ese rango)";
  const near = input.lat !== undefined ? "cerca de su ubicación" : `por el centro (${ROSARIO_CENTER.lat}, ${ROSARIO_CENTER.lng})`;
  return [
    `Ahora en Rosario: ${hourLabel(now.toISOString())}.`,
    `Eventos disponibles para ${win.label}, ordenados por cercanía:`,
    list,
    "",
    `El usuario busca planes para ${win.label}, ${near}.`,
    `Presupuesto: ${input.budget !== undefined ? `hasta $ ${input.budget.toLocaleString("es-AR")}` : "no dijo"}.`,
    `Ánimo o ganas: ${input.mood?.trim() || "no dijo"}.`,
    intent.label ? `Lo que busca, detectado: ${intent.label}. La lista ya está filtrada a eso; no propongas otra cosa.` : "",
    "Armá el plan con 2 o 3 paradas de la lista (solo de la lista), en orden de hora, con el formato indicado. Los títulos de la lista ya están acortados: usalos tal cual. Si dice \"horario a confirmar\", escribí eso en lugar de la hora.",
  ].join("\n");
}

/** Deterministic plan for mock mode, built from real store data, same format as the live answer. */
export function mockConcierge(ranked: Ranked[], win: Window): string {
  const footer = "Plan armado con HayPlan";
  if (ranked.length === 0) return `Para ${win.label} no tengo nada cargado todavía. Probá con otro día o ampliá la zona.\n${footer}`;
  const picks = ranked.slice(0, 3).sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  const firstDay = picks[0]!.event.startsAt.slice(0, 10);
  const stops = picks.map(({ event: e }) => {
    const h = hourLabel(e.startsAt);
    const hh = e.timeUnknown ? "a confirmar" : e.recurring ? `abre ${h.slice(-5)}` : h.slice(-5);
    const hour = e.startsAt.slice(0, 10) === firstDay ? hh : `${h.slice(0, 3)} ${hh}`;
    const price = e.price ? ` · ${priceLabel(e)}` : "";
    return `${hour} · ${e.shortTitle ?? e.title} · ${e.venueName}${price}`;
  });
  return [`Plan para ${win.label} (modo demo, sin API key):`, "", ...stops, "", "Entre parada y parada, a pata o en bici: todo queda cerca.", footer].join("\n");
}
