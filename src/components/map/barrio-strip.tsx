"use client";

import { useEffect, useState } from "react";
import type { Event } from "@/lib/events/schema";
import { cn } from "@/lib/utils";

type BarrioCount = { barrio: string; count: number };
type Stats = { total: number; byBarrio: BarrioCount[]; byCategory: { category: string; count: number }[] };

type Props = {
  events: Event[];
  range: { from?: string; to?: string };
  active: string;
  onPick: (barrio: string) => void;
  className?: string;
};

/** Counts per barrio from the events already on screen (fallback while /api/events/stats is not deployed). */
function countLocally(events: Event[]): BarrioCount[] {
  const m = new Map<string, number>();
  for (const e of events) if (e.barrio) m.set(e.barrio, (m.get(e.barrio) ?? 0) + 1);
  return [...m.entries()].map(([barrio, count]) => ({ barrio, count })).sort((a, b) => b.count - a.count);
}

/** "Pulso de barrios": scrollable pills with event counts; tapping one filters by that barrio. */
export function BarrioStrip({ events, range, active, onPick, className }: Props) {
  const [remote, setRemote] = useState<BarrioCount[] | null>(null);
  const key = JSON.stringify(range);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams();
    const r: Props["range"] = JSON.parse(key);
    if (r.from) params.set("from", r.from);
    if (r.to) params.set("to", r.to);
    fetch(`/api/events/stats?${params}`, { signal: ac.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Stats>) : null))
      .then((s) => setRemote(s && Array.isArray(s.byBarrio) ? s.byBarrio : null))
      .catch(() => setRemote(null));
    return () => ac.abort();
  }, [key]);

  const counts = (remote && remote.length > 0 ? remote : countLocally(events)).slice(0, 12);
  if (counts.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Eventos por barrio"
      className={cn("flex gap-1.5 overflow-x-auto [scrollbar-width:none]", className)}
    >
      {counts.map(({ barrio, count }) => {
        const on = active.trim().toLowerCase() === barrio.toLowerCase();
        return (
          <button
            key={barrio}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? "" : barrio)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors",
              on ? "border-primary bg-primary text-primary-foreground" : "bg-background/90 hover:bg-accent",
            )}
          >
            {barrio}
            <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-white/25" : "bg-muted text-muted-foreground")}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
