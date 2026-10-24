import type { Event } from "./schema";
import { ROSARIO_CENTER } from "./schema";
import { addDays, parseInstant, startOfRosarioDay } from "./time";

/** Time windows, ranking and prompt text for the concierge. Pure functions. */

export type ConciergeInput = { when: string; lat?: number; lng?: number; budget?: number; mood?: string };
export type Window = { from: Date; to: Date; label: string };

const DAY = 86_400_000;
const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "hoy" | "manana"/"mañana" | "finde" | "semana" | ISO date -> [from, to]. */
export function resolveWindow(when: string, now = new Date()): Window {
  const w = when.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const today = startOfRosarioDay(now);
  const endOfToday = new Date(today.getTime() + DAY + 4 * 3_600_000); // until 04:00 next day
  if (w === "" || w === "hoy" || w === "ahora" || w === "esta noche") return { from: now, to: endOfToday, label: "hoy" };
  if (w === "manana") return { from: addDays(today, 1), to: addDays(endOfToday, 1), label: "mañana" };
  if (w === "finde" || w === "fin de semana") {
    const dow = rosarioDow(now); // 0 = domingo
    const daysToFriday = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
    const friday = addDays(today, daysToFriday);
    const from = daysToFriday <= 0 ? now : new Date(friday.getTime() + 17 * 3_600_000);
    return { from, to: new Date(addDays(friday, 3).getTime() + 4 * 3_600_000), label: "el finde" };
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

/** Filter by budget, rank by distance (then time), keep the best `max`. */
export function rankEvents(events: Event[], input: ConciergeInput, max = 12): Ranked[] {
  const here = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;
  return events
    .filter((e) => input.budget === undefined || !e.price || e.price.free || (e.price.min ?? 0) <= input.budget)
    .map((event) => ({ event, km: here && event.lat !== undefined && event.lng !== undefined ? distanceKm(here, { lat: event.lat, lng: event.lng }) : undefined }))
    .sort((a, b) => (a.km ?? 99) - (b.km ?? 99) || a.event.startsAt.localeCompare(b.event.startsAt))
    .slice(0, max);
}

export function priceLabel(e: Event): string {
  if (!e.price) return "precio no informado";
  if (e.price.free) return "gratis";
  if (e.price.min !== undefined) return `$ desde ${e.price.min.toLocaleString("es-AR")}`;
  return "pago";
}

export function hourLabel(iso: string): string {
  const d = parseInstant(iso);
  if (!d) return iso;
  const local = new Date(d.getTime() - 3 * 3_600_000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${DAYS_ES[local.getUTCDay()]} ${hh}:${mm}`;
}

export function buildConciergePrompt(ranked: Ranked[], input: ConciergeInput, win: Window, now = new Date()): string {
  const list = ranked.length
    ? ranked
        .map(({ event: e, km }, i) => {
          const parts = [`${i + 1}. ${e.title}`, `lugar: ${e.venueName}${e.barrio ? ` (${e.barrio})` : ""}`, `cuándo: ${hourLabel(e.startsAt)}`, `precio: ${priceLabel(e)}`, `categoría: ${e.category}`];
          if (km !== undefined) parts.push(`distancia: ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}`);
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
    "Armá el plan con 2 o 3 paradas de la lista (solo de la lista), en orden de hora, con el formato indicado.",
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
    const hour = e.startsAt.slice(0, 10) === firstDay ? h.slice(-5) : `${h.slice(0, 3)} ${h.slice(-5)}`;
    return `${hour} · ${e.title} · ${e.venueName} · ${priceLabel(e)}`;
  });
  return [`Plan para ${win.label} (modo demo, sin API key):`, "", ...stops, "", "Entre parada y parada, a pata o en bici: todo queda cerca.", footer].join("\n");
}
