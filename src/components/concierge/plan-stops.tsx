"use client";

import Link from "next/link";
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

/** Tappable cards for each stop of the plan; "Ver en el mapa" searches the title on /mapa. */
export function PlanStops({ stops }: { stops: Stop[] }) {
  if (stops.length === 0) return null;
  return (
    <ol className="space-y-2" aria-label="Paradas del plan">
      {stops.map((s, i) => (
        <li key={`${s.time}-${i}`} className="stop-reveal" style={{ animationDelay: `${i * 100}ms` }}>
          <Link
            href={`/mapa?q=${encodeURIComponent(s.title)}`}
            className="glass flex items-center gap-3 rounded-xl p-3 transition-[background-color,transform] hover:bg-accent/60 active:scale-[0.98]"
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[guessCategory(`${s.title} ${s.venue}`)] }} />
            <span className="font-display w-12 shrink-0 text-lg font-bold tabular-nums">{s.time}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{s.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {s.venue}
                {s.price && ` · ${s.price}`}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-primary">
              Ver en el mapa <span aria-hidden>→</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
