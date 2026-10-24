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
  displayTitle,
  formatPrice,
  timeLabel,
  walkMinutes,
} from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvents } from "@/hooks/use-events";
import type { EventCategory } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { type Venue } from "@/components/events/venues";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
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
  /** What the sheet shows: the full list, one venue, or the venues of a cluster that cannot be split. */
  const [mode, setMode] = useState<{ kind: "list" } | { kind: "venue"; venue: Venue } | { kind: "venues"; venues: Venue[] }>({ kind: "list" });

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
  const dragStart = useRef<number | null>(null);

  function onHandlePointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onHandlePointerUp(e: React.PointerEvent) {
    if (dragStart.current == null) return;
    const dy = e.clientY - dragStart.current;
    dragStart.current = null;
    if (dy < -30) setExpanded(true);
    else if (dy > 30) setExpanded(false);
    else return; // a tap: the click handler toggles
    setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
  }

  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Deep link from the concierge: /mapa?q=título
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    if (cat && (CATEGORIES as string[]).includes(cat)) setCategory(cat as EventCategory);
    const initial = params.get("q");
    if (initial) {
      setQuery(initial);
      setQ(initial);
      setExpanded(true);
    }
  }, []);

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

  function openVenue(venue: Venue) {
    setMode({ kind: "venue", venue });
    setSelectedId(venue.events[0]?.id ?? null);
    setExpanded(false);
  }

  function backToList() {
    setMode({ kind: "list" });
    setSelectedId(null);
  }

  // Filters changed: the venue shown may be gone; fall back to the list.
  useEffect(() => {
    setMode((m) => (m.kind === "list" ? m : { kind: "list" }));
  }, [events]);

  // Keep the selected card in view when a pin is tapped.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const count = status === "done" ? `${events.length} evento${events.length === 1 ? "" : "s"}` : "Buscando…";

  const venueGroups = (venue: Venue) => {
    const map = new Map<string, { label: string; events: Venue["events"] }>();
    for (const e of venue.events) {
      const key = rosarioDayKey(e.startsAt);
      const g = map.get(key) ?? { label: relativeDayLabel(e.startsAt), events: [] };
      g.events.push(e);
      map.set(key, g);
    }
    return [...map.values()];
  };

  const directions = (v: Venue) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${v.lat},${v.lng}`)}&travelmode=transit`;

  /** Sheet body in venue mode: header, Cómo llegar, events by day, each row → /evento/[id]. */
  const venuePanel = (venue: Venue) => (
    <div className="space-y-4">
      <button type="button" onClick={backToList} className="text-sm text-muted-foreground hover:underline">
        ← Todos los eventos
      </button>
      <div className="space-y-1">
        <h2 className="text-lg font-bold leading-tight">{venue.name}</h2>
        {venue.address && <p className="text-sm text-muted-foreground">{venue.address}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button asChild size="sm">
            <a href={directions(venue)} target="_blank" rel="noopener noreferrer">
              Cómo llegar
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">
            {venue.events.length} evento{venue.events.length === 1 ? "" : "s"}
            {me && walkMinutes(me, venue) != null && ` · a ${walkMinutes(me, venue)} min caminando`}
          </span>
        </div>
      </div>
      {venueGroups(venue).map((g) => (
        <section key={g.label} aria-label={g.label} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
          <ul className="space-y-1.5">
            {g.events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/evento/${e.id}`}
                  className="glass flex items-center gap-3 rounded-xl p-3 transition-[background-color,transform] hover:bg-accent/60 active:scale-[0.98]"
                >
                  <span className={cn("font-display shrink-0 tabular-nums", e.timeUnknown ? "w-16 text-[11px] leading-tight text-muted-foreground" : "w-12 text-base font-bold")}>
                    {e.timeUnknown ? "a confirmar" : timeLabel(e)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{displayTitle(e)}</span>
                    <span className="mt-0.5 flex gap-1.5">
                      <Badge variant={e.price?.free ? "success" : "secondary"}>{formatPrice(e.price)}</Badge>
                      <Badge style={{ background: CATEGORY_COLORS[e.category], color: "#fff" }}>{CATEGORY_LABELS[e.category]}</Badge>
                    </span>
                  </span>
                  <span aria-hidden className="text-muted-foreground">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  /** Sheet body when a cluster cannot be split: pick a venue. */
  const venuesPanel = (venues: Venue[]) => (
    <div className="space-y-3">
      <button type="button" onClick={backToList} className="text-sm text-muted-foreground hover:underline">
        ← Todos los eventos
      </button>
      <h2 className="text-base font-bold">{venues.length} lugares acá</h2>
      <ul className="space-y-1.5">
        {venues.map((v) => (
          <li key={v.key}>
            <button
              type="button"
              onClick={() => openVenue(v)}
              className="glass flex w-full items-center gap-3 rounded-xl p-3 text-left transition-[background-color,transform] hover:bg-accent/60 active:scale-[0.98]"
            >
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[v.category] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{v.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {v.events.length} evento{v.events.length === 1 ? "" : "s"}
                  {v.address && ` · ${v.address}`}
                </span>
              </span>
              <span aria-hidden className="text-muted-foreground">→</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );


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
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        <FilterChips label="Cuándo" chips={DAY_CHIPS} value={day} onChange={setDay} />
        <span aria-hidden className="my-1 w-px shrink-0 bg-border" />
        <FilterChips label="Categoría" chips={CATEGORY_CHIPS} value={category} onChange={setCategory} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <p className="text-muted-foreground" aria-live="polite">
          {count}
        </p>
        <div role="group" aria-label="Orden" className="flex gap-1">
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
              className={cn("rounded-full px-2 py-0.5 font-medium transition-colors", sort === v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent")}
            >
              {label}
            </button>
          ))}
        </div>
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
          <h2 className="sticky top-0 z-20 -mx-3 mb-2 border-b border-white/10 bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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


  const body = mode.kind === "venue" ? venuePanel(mode.venue) : mode.kind === "venues" ? venuesPanel(mode.venues) : list;

  return (
    <div className="relative flex flex-col md:flex-row">
      {/* Map */}
      <div className={cn("relative shrink-0 transition-[height] duration-300 ease-out", expanded ? "h-[15dvh]" : "h-[50dvh]", "md:h-[calc(100dvh-3.5rem)] md:flex-1")}>
        <EventMap
          events={events}
          selectedId={selectedId}
          onSelectVenue={openVenue}
          onSelectCluster={(vs) => {
            setMode({ kind: "venues", venues: vs });
            setExpanded(false);
          }}
          fit={status === "done" && mode.kind === "list"}
          explore
          onLocate={setMe}
        />
        <BarrioStrip
          events={events}
          range={range}
          active={query}
          onPick={(b) => {
            setQuery(b);
            setQ(b);
          }}
          className="absolute left-14 right-3 top-3 z-[1000] pr-14 [mask-image:linear-gradient(to_right,black_calc(100%-5.5rem),transparent_calc(100%-3rem))]"
        />
      </div>

      {/* Desktop side panel */}
      <aside className="glass hidden h-[calc(100dvh-3.5rem)] w-96 flex-col md:flex" aria-label="Lista de eventos">
        {mode.kind === "list" && <div className="space-y-2 border-b p-3">{filters}</div>}
        <div className="relative min-h-0 flex-1 overflow-y-auto p-3">{body}</div>
      </aside>

      {/* Mobile bottom sheet */}
      <section
        aria-label="Lista de eventos"
        className={cn(
          "glass flex min-h-0 flex-col rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.25)] transition-[height] duration-300 ease-out md:hidden",
          expanded ? "h-[calc(85dvh-3.5rem)]" : "h-[calc(50dvh-3.5rem)]",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
          }}
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={() => (dragStart.current = null)}
          aria-expanded={expanded}
          className="flex w-full touch-none select-none flex-col items-center gap-1 pb-1 pt-2"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
          <span className="text-xs text-muted-foreground">{expanded ? "Ver mapa" : "Ver lista"}</span>
        </button>
        {mode.kind === "list" && <div className="space-y-2 px-3 pb-2">{filters}</div>}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-4">{body}</div>
      </section>
    </div>
  );
}
