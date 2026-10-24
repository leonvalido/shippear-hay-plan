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
  type LatLng,
} from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvents } from "@/hooks/use-events";
import type { EventCategory } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { BarrioStrip } from "./barrio-strip";
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
  const [sort, setSort] = useState<"hora" | "views">("hora");
  const [me, setMe] = useState<LatLng | null>(null);

  // If the user already granted location to this site, pick it up silently (no prompt).
  useEffect(() => {
    if (!("permissions" in navigator) || !("geolocation" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { timeout: 8000, maximumAge: 300_000 },
        );
      })
      .catch(() => {});
  }, []);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const range = useMemo(() => dayRange(day), [day]);
  const { events, status, error, refetch } = useEvents({ ...range, category, q });

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; events: typeof events }>();
    if (sort === "views") {
      const byViews = [...events].sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0));
      return [["views", { label: "Lo que más se mueve", events: byViews }] as const];
    }
    for (const e of events) {
      const key = rosarioDayKey(e.startsAt);
      const g = map.get(key) ?? { label: relativeDayLabel(e.startsAt), events: [] };
      g.events.push(e);
      map.set(key, g);
    }
    return [...map.entries()];
  }, [events, sort]);

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
        placeholder="Buscá un plan, un lugar o un barrio"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 bg-background"
      />
      <FilterChips label="Cuándo" chips={DAY_CHIPS} value={day} onChange={setDay} />
      <FilterChips label="Categoría" chips={CATEGORY_CHIPS} value={category} onChange={setCategory} />
      <div role="group" aria-label="Orden" className="flex rounded-lg border p-0.5 text-xs">
        {(
          [
            ["hora", "Por hora"],
            ["views", "Lo que más se mueve"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={sort === v}
            onClick={() => setSort(v)}
            className={cn("flex-1 rounded-md px-2 py-1 font-medium transition-colors", sort === v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent")}
          >
            {label}
          </button>
        ))}
      </div>
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
          <p className="font-medium text-foreground">No hay nada con esos filtros.</p>
          <p>Sacá uno o probá otro día.</p>
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
              <EventCard key={e.id} event={e} selected={e.id === selectedId} onSelect={selectFromList} showDate={sort === "views"} from={me} />
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
        <EventMap events={events} selectedId={selectedId} onSelect={setSelectedId} fit={status === "done"} explore onLocate={setMe} />
        <BarrioStrip
          events={events}
          range={range}
          active={query}
          onPick={(b) => {
            setQuery(b);
            setQ(b);
          }}
          className="absolute left-14 right-16 top-3 z-[1000]"
        />
      </div>

      {/* Desktop side panel */}
      <aside className="glass hidden h-[calc(100dvh-3.5rem)] w-96 flex-col md:flex" aria-label="Lista de eventos">
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
          "glass flex min-h-0 flex-col rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.25)] md:hidden",
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
