"use client";

import Link from "next/link";

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

/** Tappable cards for each stop of the plan; "Ver en el mapa" searches the title on /mapa. */
export function PlanStops({ stops }: { stops: Stop[] }) {
  if (stops.length === 0) return null;
  return (
    <ol className="space-y-2" aria-label="Paradas del plan">
      {stops.map((s, i) => (
        <li key={`${s.time}-${i}`}>
          <Link
            href={`/mapa?q=${encodeURIComponent(s.title)}`}
            className="glass flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent/60"
          >
            <span className="font-display w-14 shrink-0 text-lg font-bold tabular-nums">{s.time}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{s.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {s.venue}
                {s.price && ` · ${s.price}`}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-primary">Ver en el mapa</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
