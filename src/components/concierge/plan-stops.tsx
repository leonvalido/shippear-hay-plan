"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS } from "@/components/events/format";
import type { EventCategory } from "@/lib/events/schema";

export type Stop = { time: string; title: string; venue: string; price?: string };

const LINE = /^\s*(?:[-*•]\s*|\d+[.)]\s*)?\**(\d{1,2}:\d{2})\**(?:\s*hs?\.?)?\s*[·\-–—|]\s*\**(.+?)\**\s*[·\-–—|]\s*\**(.+?)\**(?:\s*[·\-–—|]\s*\**(.+?)\**)?\s*$/;

/** Pull "HH:MM · título · lugar · precio" lines out of the concierge answer. Anything else stays as text. */
export function parseStops(text: string): Stop[] {
  const stops: Stop[] = [];
  for (const raw of text.split("\n")) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const [, time, title, venue, price] = m;
    if (title.length < 2 || venue.length < 2) continue;
    stops.push({ time: time.padStart(5, "0"), title: title.trim(), venue: venue.trim(), price: price?.trim() });
  }
  return stops;
}

/** Best-effort category from the words in the line, for the dot color. */
function guessCategory(s: string): EventCategory {
  const t = s.toLowerCase();
  if (/recital|banda|concierto|dj|jazz|rock|cumbia|música|musica/.test(t)) return "musica";
  if (/fiesta|boliche|after|party/.test(t)) return "fiesta";
  if (/feria|mercado/.test(t)) return "feria";
  if (/teatro|obra|stand ?up|función|funcion/.test(t)) return "teatro";
  if (/partido|fútbol|futbol|carrera|maratón|maraton/.test(t)) return "deporte";
  if (/museo|muestra|cine|charla|libro|expo/.test(t)) return "cultura";
  if (/bar|cerveza|comida|gastro|vino/.test(t)) return "gastronomia";
  if (/niñ|nin|infantil|familia/.test(t)) return "infantil";
  return "otro";
}

/** ALL CAPS titles → "Title Case"; mixed-case titles are left alone. */
function tidyTitle(t: string): string {
  if (t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  return t.toLowerCase().replace(/(^|[\s(¡¿"'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
}

/** Tappable cards for each stop of the plan; "Ver en el mapa" searches the title on /mapa. */
export function PlanStops({ stops }: { stops: Stop[] }) {
  if (stops.length === 0) return null;
  return (
    <ol className="space-y-3" aria-label="Paradas del plan">
      {stops.map((s, i) => (
        <li key={`${s.time}-${i}`} className="stop-reveal" style={{ animationDelay: `${i * 100}ms` }}>
          <Link href={`/mapa?q=${encodeURIComponent(s.title)}`} className="surface tap flex flex-col gap-2 p-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[guessCategory(`${s.title} ${s.venue}`)] }} />
              <span className="tabular-nums">{s.time}</span>
            </span>
            <span className="line-clamp-2 text-base font-semibold">{tidyTitle(s.title)}</span>
            <span className="truncate text-sm text-muted-foreground">{s.venue}</span>
            <span className="flex items-center justify-between gap-2">
              {s.price ? <Badge variant={/gratis|libre/i.test(s.price) ? "success" : "secondary"}>{s.price}</Badge> : <span />}
              <span className="inline-flex h-8 items-center rounded-full border border-white/8 px-3 text-sm font-medium text-primary">
                Ver en el mapa <span aria-hidden className="ml-1">→</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
