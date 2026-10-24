import type { Event, EventCategory, SourceType } from "@/lib/events/schema";

export const TZ = "America/Argentina/Cordoba";
/** Argentina has no DST: Rosario is always UTC-03:00. */
const OFFSET_MS = 3 * 60 * 60 * 1000;

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  musica: "Música",
  teatro: "Teatro",
  fiesta: "Fiesta",
  feria: "Feria",
  deporte: "Deporte",
  cultura: "Cultura",
  gastronomia: "Gastronomía",
  infantil: "Infantil",
  charla: "Charla",
  otro: "Otro",
};

/** Brand category colors (brand/tokens.css), as literals because Leaflet writes them into SVG attributes. */
export const CATEGORY_COLORS: Record<EventCategory, string> = {
  musica: "oklch(0.52 0.24 330)",
  teatro: "oklch(0.52 0.21 20)",
  fiesta: "oklch(0.50 0.23 295)",
  feria: "oklch(0.55 0.15 65)",
  deporte: "oklch(0.52 0.16 150)",
  cultura: "oklch(0.50 0.20 255)",
  gastronomia: "oklch(0.55 0.20 40)",
  infantil: "oklch(0.52 0.13 205)",
  charla: "oklch(0.50 0.12 110)",
  otro: "oklch(0.50 0.02 280)",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategory[];

export const SOURCE_LABELS: Record<SourceType, string> = {
  municipal: "Municipalidad",
  ticketing: "Ticketera",
  platform: "Plataforma",
  press: "Prensa",
  tiktok: "TikTok",
  instagram: "Instagram",
  flyer: "Flyer",
  manual: "Manual",
};

const fmtWeekday = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, weekday: "short" });
const fmtDay = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, month: "short" });
const fmtTime = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

const clean = (s: string) => s.replace(/\.$/, "").toLowerCase();

/** "sáb 25 oct" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${clean(fmtWeekday.format(d))} ${fmtDay.format(d)} ${clean(fmtMonth.format(d))}`;
}

/** "sáb 25" */
export function formatDayShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${clean(fmtWeekday.format(d))} ${fmtDay.format(d)}`;
}

/** "oct" */
export function formatMonthShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return clean(fmtMonth.format(d));
}

/** "21:00" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return fmtTime.format(d).replace(/^24/, "00");
}

type Timed = { startsAt: string; timeUnknown?: boolean };
type Titled = { title: string; shortTitle?: string };

/** Short title for pins, cards and sheets; the detail page shows both. */
export function displayTitle(e: Titled): string {
  return e.shortTitle?.trim() || e.title;
}

/** "21:00", or "horario a confirmar" when the source had no time. */
export function timeLabel(e: Timed): string {
  return e.timeUnknown ? "horario a confirmar" : formatTime(e.startsAt);
}

/** "Hoy 21:00" · "Mañana 21:00" · "sáb 25 · 21:00" · "sáb 25 · horario a confirmar" */
export function formatWhen(e: Timed, now = new Date()): string {
  const day = relativeDayLabel(e.startsAt, now);
  const t = timeLabel(e);
  if (day === "Hoy" || day === "Mañana") return `${day} ${t}`;
  return `${formatDayShort(e.startsAt)} · ${t}`;
}

/** "sáb 25 oct, 21:00" */
export function formatDateTime(iso: string): string {
  const date = formatDate(iso);
  return date ? `${date}, ${formatTime(iso)}` : "";
}

const fmtARS = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function formatPrice(price: Event["price"]): string {
  if (!price) return "Precio a confirmar";
  if (price.free) return "Gratis";
  if (price.min != null && price.max != null && price.max !== price.min) {
    return `$${fmtARS.format(price.min)} – $${fmtARS.format(price.max)}`;
  }
  const v = price.min ?? price.max;
  return v != null ? `$${fmtARS.format(v)}` : "Precio a confirmar";
}

/** 12300 → "12,3 mil", 1500000 → "1,5 M" */
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("es-AR");
}

export const SOCIAL_SOURCES = new Set<SourceType>(["tiktok", "instagram"]);

export function sourceLabel(e: Pick<Event, "sourceType" | "sourceName">): string {
  return e.sourceName && e.sourceName !== "sample" ? e.sourceName : SOURCE_LABELS[e.sourceType];
}

/** Midnight in Rosario, `days` days from today, as a UTC Date. */
export function rosarioDayStart(days = 0, now = new Date()): Date {
  const local = new Date(now.getTime() - OFFSET_MS);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days);
  return new Date(midnightLocal + OFFSET_MS);
}

/** Day of week in Rosario (0 = Sunday). */
export function rosarioWeekday(now = new Date()): number {
  return new Date(now.getTime() - OFFSET_MS).getUTCDay();
}

/** "Hoy", "Mañana" or "sáb 25 oct" for grouping the list. */
export function relativeDayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.getTime();
  if (t >= rosarioDayStart(0, now).getTime() && t < rosarioDayStart(1, now).getTime()) return "Hoy";
  if (t >= rosarioDayStart(1, now).getTime() && t < rosarioDayStart(2, now).getTime()) return "Mañana";
  return formatDate(iso);
}

/** "2026-10-25" in Rosario time, for grouping. */
export function rosarioDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Walking minutes at 80 m/min, rounded; null when either point is missing. */
export function walkMinutes(from: LatLng | null | undefined, e: { lat?: number; lng?: number }): number | null {
  if (!from || e.lat == null || e.lng == null) return null;
  return Math.max(1, Math.round(haversineMeters(from, { lat: e.lat, lng: e.lng }) / 80));
}

export type DayFilter = "hoy" | "manana" | "finde" | "semana";

export const DAY_LABELS: Record<DayFilter, string> = { hoy: "Hoy", manana: "Mañana", finde: "Finde", semana: "Semana" };

/** [from, to] ISO strings for a day chip; null → API default (now → +14 days). */
export function dayRange(filter: DayFilter | null, now = new Date()): { from?: string; to?: string } {
  if (!filter) return {};
  const iso = (d: Date) => d.toISOString();
  switch (filter) {
    case "hoy":
      return { from: iso(now), to: iso(rosarioDayStart(1, now)) };
    case "manana":
      return { from: iso(rosarioDayStart(1, now)), to: iso(rosarioDayStart(2, now)) };
    case "finde": {
      // Friday evening through Sunday night; if it's already the weekend, from now.
      const wd = rosarioWeekday(now);
      const toFriday = wd === 0 ? -2 : wd === 6 ? -1 : 5 - wd;
      const friday = new Date(rosarioDayStart(toFriday, now).getTime() + 18 * 60 * 60 * 1000);
      const from = friday > now ? friday : now;
      return { from: iso(from), to: iso(rosarioDayStart(toFriday + 3, now)) };
    }
    case "semana":
      return { from: iso(now), to: iso(rosarioDayStart(7, now)) };
  }
}
