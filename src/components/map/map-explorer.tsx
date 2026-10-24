"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventCard, EventCardSkeleton } from "@/components/events/event-card";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DAY_LABELS,
  dayRange,
  relativeDayLabel,
  rosarioDayKey,
  type DayFilter,
} from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvents } from "@/hooks/use-events";
import type { EventCategory } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { EventMap } from "./event-map";
import { FilterChips } from "./filter-chips";

const DAY_CHIPS = (Object.keys(DAY_LABELS) as DayFilter[]).map((value) => ({ value, label: DAY_LABELS[value] }));
const CATEGORY_CHIPS = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value], color: CATEGORY_COLORS[value] }));

/** The /mapa screen: map + filters + list (bottom sheet on phones, side panel on laptops). */
export function MapExplorer() {
  const [day, setDay] = useState<DayFilter | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const range = useMemo(() => dayRange(day), [day]);
  const { events, status, error, refetch } = useEvents({ ...range, category, q });

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; events: typeof events }>();
    for (const e of events) {
      const key = rosarioDayKey(e.startsAt);
      const g = map.get(key) ?? { label: relativeDayLabel(e.startsAt), events: [] };
      g.events.push(e);
      map.set(key, g);
    }
    return [...map.entries()];
  }, [events]);

  function selectFromList(id: string) {
    setSelectedId(id);
    setExpanded(false); // on phones, bring the map back so the pin is visible
  }

  // Keep the selected card in view when a pin is tapped.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const filters = (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="map-search">
        Buscar eventos
      </label>
      <Input
        id="map-search"
        type="search"
        placeholder="Buscar por nombre o lugar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 bg-background"
      />
      <FilterChips label="Cuándo" chips={DAY_CHIPS} value={day} onChange={setDay} />
      <FilterChips label="Categoría" chips={CATEGORY_CHIPS} value={category} onChange={setCategory} />
    </div>
  );

  const list = (
    <div ref={listRef} className="space-y-4">
      {status === "loading" && events.length === 0 && Array.from({ length: 4 }, (_, i) => <EventCardSkeleton key={i} />)}
      {status === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">No se pudieron cargar los eventos.</p>
          <p className="text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )}
      {status === "done" && events.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No hay eventos con esos filtros.</p>
          <p>Probá con otro día o categoría.</p>
        </div>
      )}
      {groups.map(([key, g]) => (
        <section key={key} aria-label={g.label}>
          <h2 className="sticky top-0 z-10 -mx-1 mb-2 bg-background/95 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
            {g.label}
            <span className="ml-1.5 font-normal normal-case">· {g.events.length}</span>
          </h2>
          <div className="space-y-2">
            {g.events.map((e) => (
              <EventCard key={e.id} event={e} selected={e.id === selectedId} onSelect={selectFromList} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  const count = status === "done" ? `${events.length} evento${events.length === 1 ? "" : "s"}` : "Buscando…";

  return (
    <div className="relative flex flex-col md:flex-row">
      {/* Map */}
      <div className={cn("relative shrink-0 transition-[height]", expanded ? "h-[15dvh]" : "h-[50dvh]", "md:h-[calc(100dvh-3.5rem)] md:flex-1")}>
        <EventMap events={events} selectedId={selectedId} onSelect={setSelectedId} fit={status === "done"} explore />
      </div>

      {/* Desktop side panel */}
      <aside className="hidden h-[calc(100dvh-3.5rem)] w-96 flex-col border-l md:flex" aria-label="Lista de eventos">
        <div className="space-y-2 border-b p-3">
          {filters}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {count}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{list}</div>
      </aside>

      {/* Mobile bottom sheet */}
      <section
        aria-label="Lista de eventos"
        className={cn(
          "flex min-h-0 flex-col rounded-t-2xl border-t bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden",
          expanded ? "h-[calc(85dvh-3.5rem)]" : "h-[calc(50dvh-3.5rem)]",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full flex-col items-center gap-1 pb-1 pt-2"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
          <span className="text-xs text-muted-foreground">
            {count} · {expanded ? "ver mapa" : "ver lista"}
          </span>
        </button>
        <div className="space-y-2 px-3 pb-2">{filters}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">{list}</div>
      </section>
    </div>
  );
}
