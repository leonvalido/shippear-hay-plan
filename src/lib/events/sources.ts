import { z } from "zod";
import { RawEventSchema, type EventCategory, type RawEvent } from "./schema";
import { sourceTypeOf } from "./extract";
import { normalizeText } from "./normalize";
import { ROSARIO_OFFSET, rosarioDate, toRosarioISO } from "./time";

/**
 * Converters for the radar's own event extractions (no Claude call) and for
 * the Venti export. Everything returns RawEvent | undefined and never throws.
 */

const MIN_CONFIDENCE = 0.6;

/** One extracted event as the radar writes it (eventos-rosario.json), or nested under `extraccion` (eventos-argon.json). */
const RadarFieldsSchema = z.object({
  es_evento: z.boolean().optional(),
  titulo: z.string().optional().nullable(),
  fecha: z.string().optional().nullable(),
  hora: z.string().optional().nullable(),
  lugar: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  precio: z.union([z.string(), z.number()]).optional().nullable(),
  organizador: z.string().optional().nullable(),
  confianza: z.number().optional().nullable(),
});
export const RadarRowSchema = RadarFieldsSchema.extend({
  url: z.string().optional().nullable(),
  video_id: z.union([z.string(), z.number()]).optional().nullable(),
  handle: z.string().optional().nullable(),
  descr: z.string().optional().nullable(),
  vistas: z.union([z.string(), z.number()]).optional().nullable(),
  likes: z.union([z.string(), z.number()]).optional().nullable(),
  extraccion: RadarFieldsSchema.optional().nullable(),
});
export type RadarRow = z.infer<typeof RadarRowSchema>;

export type Convert = { event?: RawEvent; reason?: "no-event" | "low-confidence" | "no-date" | "past" | "no-place" | "tour" | "invalid" };

const CITY_WORDS = ["caba", "buenos aires", "cordoba", "mendoza", "la plata", "neuquen", "montevideo", "santa fe capital", "parana"];

/** Radar extraction -> RawEvent. `today` is YYYY-MM-DD in Rosario. */
export function radarRowToRaw(row: RadarRow, today = rosarioDate()): Convert {
  const f = { ...row, ...(row.extraccion ?? {}) };
  if (f.es_evento === false) return { reason: "no-event" };
  if ((f.confianza ?? 0) < MIN_CONFIDENCE) return { reason: "low-confidence" };
  if (!f.titulo || !f.fecha || !/^\d{4}-\d{2}-\d{2}/.test(f.fecha)) return { reason: "no-date" };
  const date = f.fecha.slice(0, 10);
  if (date < today) return { reason: "past" };
  const lugar = (f.lugar ?? "").trim();
  if (!lugar) return { reason: "no-place" };
  if (lugar.split(",").length > 2 || /gira/i.test(lugar)) return { reason: "tour" };
  const lugarNorm = normalizeText(lugar);
  if (CITY_WORDS.some((c) => lugarNorm.includes(c)) && !lugarNorm.includes("rosario")) return { reason: "tour" };

  const hora = parseHour(f.hora);
  const url = f.url ?? undefined;
  const sourceType = url ? sourceTypeOf(url) : "tiktok";
  const handle = f.handle ? `@${f.handle.replace(/^@/, "")}` : undefined;
  const text = `${f.titulo} ${f.descr ?? ""}`;
  const candidate = {
    title: f.titulo.trim().slice(0, 160),
    description: (f.descr ?? "").replace(/\s+/g, " ").trim().slice(0, 600) || undefined,
    startsAt: `${date}T${hora ?? "00:00"}:00${ROSARIO_OFFSET}`,
    timeUnknown: hora ? undefined : true,
    venueName: lugar.slice(0, 120),
    address: f.direccion?.trim() || undefined,
    category: guessCategory(text),
    price: parsePrice(f.precio),
    sourceType,
    sourceName: handle ?? f.organizador?.trim() ?? undefined,
    sourceUrl: url,
    links: url ? [{ label: sourceType === "tiktok" ? "Ver en TikTok" : "Ver en Instagram", url }] : undefined,
    metrics: metrics(f.vistas, f.likes),
  };
  const parsed = RawEventSchema.safeParse(candidate);
  return parsed.success ? { event: parsed.data } : { reason: "invalid" };
}

function parseHour(h?: string | null): string | undefined {
  const m = h?.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return undefined;
  const hh = Number(m[1]);
  if (hh > 23) return undefined;
  return `${String(hh).padStart(2, "0")}:${m[2] ?? "00"}`;
}

export function parsePrice(p?: string | number | null): RawEvent["price"] {
  if (p === undefined || p === null || p === "") return undefined;
  if (typeof p === "number") return p === 0 ? { free: true, currency: "ARS" } : { free: false, min: p, currency: "ARS" };
  const t = normalizeText(p);
  if (/gratis|libre|gorra|free|sin cargo/.test(t)) return { free: true, currency: "ARS" };
  const nums = [...p.replace(/\.(?=\d{3})/g, "").matchAll(/\d+(?:,\d+)?/g)].map((m) => Number(m[0].replace(",", "."))).filter((n) => n > 0);
  if (nums.length === 0) return undefined;
  return { free: false, min: Math.min(...nums), ...(nums.length > 1 ? { max: Math.max(...nums) } : {}), currency: "ARS" };
}

function metrics(v?: string | number | null, l?: string | number | null): RawEvent["metrics"] {
  const views = count(v);
  const likes = count(l);
  if (views === undefined && likes === undefined) return undefined;
  return { ...(views !== undefined ? { views } : {}), ...(likes !== undefined ? { likes } : {}) };
}
function count(x?: string | number | null): number | undefined {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x.replace(/[^\d]/g, "")) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

const CATEGORY_HINTS: [EventCategory, RegExp][] = [
  ["infantil", /infantil|ni[nñ]os|bebes|familia|titeres/],
  ["teatro", /teatro|obra|stand ?up|comedia|monologo|impro/],
  ["fiesta", /fiesta|dj|after|boliche|rave|electronica|cumbia(?! en vivo)|joda|previa/],
  ["feria", /feria|mercado|bazar|expo|emprendedor/],
  ["deporte", /maraton|carrera|torneo|partido|futbol|running|bici|yoga|crossfit/],
  ["gastronomia", /gastronom|degustacion|cena|brunch|cerveza|vino|food/],
  ["charla", /charla|taller|workshop|curso|conferencia|seminario|clase/],
  ["cultura", /muestra|exposicion|museo|cine|pelicula|libro|lectura|poesia|arte/],
  ["musica", /show|recital|banda|en vivo|concierto|festival|toca|tocan|musica|rock|jazz|tango|folklore|trap|cantante|gira/],
];
export function guessCategory(text: string): EventCategory {
  const t = normalizeText(text);
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(t)) return cat;
  return "otro";
}

// ---------- Venti export (data/private/html/venti/rosario-events.json) ----------

export const VentiRowSchema = z.object({
  name: z.string().min(1),
  urlName: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export function ventiRowToRaw(row: z.infer<typeof VentiRowSchema>): RawEvent | undefined {
  const when = row.startDate ?? row.date;
  const d = when ? new Date(when) : undefined;
  if (!d || Number.isNaN(d.getTime())) return undefined;
  const slug = row.urlName ?? row.slug ?? undefined;
  const candidate = {
    title: row.name.trim().slice(0, 160),
    startsAt: toRosarioISO(d),
    venueName: row.venue?.trim() || "Venti",
    address: row.address?.trim() || undefined,
    category: guessCategory(row.name),
    price: { free: false, currency: "ARS" as const },
    sourceType: "ticketing" as const,
    sourceName: "Venti",
    sourceUrl: slug ? `https://venti.live/evento/${slug}` : undefined,
  };
  const parsed = RawEventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
