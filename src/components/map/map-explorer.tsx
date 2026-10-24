"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventCard, EventCardEditorial, EventCardSkeleton } from "@/components/events/event-card";
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
  formatTime,
  formatWhen,
  formatWhenLong,
  hasPrice,
  humanizeTitle,
  distanceLabel,
  walkMinutes,
} from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvents } from "@/hooks/use-events";
import type { Event, EventCategory } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { type Venue } from "@/components/events/venues";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AIResult } from "@/components/ai-result";
import { PlanStops, parseStops } from "@/components/concierge/plan-stops";
import { parsePlan } from "@/components/concierge/plan-stream";
import { PlanView } from "@/components/concierge/plan-view";
import { WhatsAppButton } from "@/components/concierge/whatsapp-button";
import { useStream } from "@/hooks/use-stream";
import { BarrioStrip } from "./barrio-strip";
import { ConciergeBar, type Budget } from "./concierge-bar";
import { TileCache } from "./tile-cache";
import { Logo } from "@/components/layout/logo";
import { CategoryIcon, STACK_ICON_PATH } from "@/components/events/category-icon";
import { EventMap } from "./event-map";
import { FilterChips } from "./filter-chips";

const DAY_CHIPS = (Object.keys(DAY_LABELS) as DayFilter[]).map((value) => ({ value, label: DAY_LABELS[value] }));
const CATEGORY_CHIPS = CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
  color: CATEGORY_COLORS[value],
  icon: <CategoryIcon category={value} className="size-3.5" />,
}));

/** The /mapa screen: map + filters + list (bottom sheet on phones, side panel on laptops). */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Events of one day grouped by their start hour (list option 2); unknown times go last. */
function hourGroups(events: Event[]): { key: string; hour: string; minutes: string; unknown: boolean; events: Event[] }[] {
  const groups = new Map<string, { key: string; hour: string; minutes: string; unknown: boolean; events: Event[] }>();
  for (const e of events) {
    const unknown = !!e.timeUnknown;
    const t = unknown ? "" : formatTime(e.startsAt);
    const hour = unknown ? "" : t.slice(0, 2);
    const key = unknown ? "zz" : hour;
    let g = groups.get(key);
    if (!g) {
      g = { key, hour, minutes: unknown ? "" : t.slice(3, 5), unknown, events: [] };
      groups.set(key, g);
    } else if (!unknown && g.minutes !== t.slice(3, 5)) {
      g.minutes = "00";
    }
    g.events.push(e);
  }
  return [...groups.values()];
}

export function MapExplorer({ initialEvents }: { initialEvents?: Event[] }) {
  const [day, setDay] = useState<DayFilter | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Phones: the sheet is an overlay; closed = map and hero bar only. Desktop keeps the side list. */
  const [expanded, setExpanded] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [sort, setSort] = useState<"hora" | "views">("hora");
  const [me, setMe] = useState<LatLng | null>(null);
  /** What the sheet shows: the full list, one venue, or the venues of a cluster that cannot be split. */
  const [mode, setMode] = useState<{ kind: "list" } | { kind: "venue"; venue: Venue } | { kind: "venues"; venues: Venue[] } | { kind: "plan" }>({ kind: "list" });
  const [budget, setBudget] = useState<Budget>(null);
  const [near, setNear] = useState(false);
  const [locating, setLocating] = useState(false);
  const [focusBar, setFocusBar] = useState(false);
  const ai = useStream("/api/concierge");

  /** "Cerca mío": ask for the position once; fall back silently. */
  function requestLocation() {
    if (me || !("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  function toggleNear(on: boolean) {
    setNear(on);
    if (on) requestLocation();
  }

  /** A plan stop was tapped: filter the list to it, highlight its pin and show the map. */
  function showStopOnMap(stop: { title: string; venue: string }) {
    const key = norm(stop.title);
    const hit = events.find((e) => norm(displayTitle(e)) === key || norm(e.title) === key) ?? events.find((e) => norm(e.venueName) === norm(stop.venue));
    setQuery(stop.title);
    setQ(stop.title);
    setMode({ kind: "list" });
    if (hit) setSelectedId(hit.id);
    setExpanded(false);
  }

  function askConcierge(text: string) {
    const when = day ?? "hoy";
    ai.run({ when, lat: me?.lat, lng: me?.lng, budget: budget ?? undefined, mood: text || undefined });
    setMode({ kind: "plan" });
    setExpanded(true);
  }

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
    if (dy > 30) setExpanded(false);
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
    if (params.get("concierge")) setFocusBar(true);
    if (params.get("embed")) {
      setEmbed(true);
      document.body.classList.add("embed");
    }
    const initial = params.get("q");
    if (initial) {
      setQuery(initial);
      setQ(initial);
      setExpanded(true);
    }
  }, []);

  const range = useMemo(() => dayRange(day), [day]);
  const { events, status, error, refetch } = useEvents({ ...range, category, q }, initialEvents);

  const shown = useMemo(() => {
    let list = events;
    if (budget === 0) list = list.filter((e) => e.price?.free);
    else if (budget != null) list = list.filter((e) => e.price?.free || (e.price?.min ?? e.price?.max ?? 0) <= budget);
    if (near && me) {
      list = list
        .filter((e) => (walkMinutes(me, e) ?? Infinity) <= 40)
        .sort((a, b) => (walkMinutes(me, a) ?? 0) - (walkMinutes(me, b) ?? 0));
    }
    return list;
  }, [events, budget, near, me]);

  const groups = useMemo(() => {
    const events = shown;
    const map = new Map<string, { label: string; events: typeof events }>();
    if (sort === "views") {
      const byViews = [...events].sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0) || a.startsAt.localeCompare(b.startsAt));
      return [["views", { label: "Lo que más se mueve", events: byViews }] as const];
    }
    for (const e of events) {
      const key = rosarioDayKey(e.startsAt);
      const g = map.get(key) ?? { label: relativeDayLabel(e.startsAt), events: [] };
      g.events.push(e);
      map.set(key, g);
    }
    return [...map.entries()];
  }, [shown, sort]);

  /** Hover/focus on a card: highlight its pin. Tapping the card navigates, so the sheet stays as it is. */
  function selectFromList(id: string) {
    setSelectedId(id);
  }

  function openVenue(venue: Venue) {
    setMode({ kind: "venue", venue });
    setSelectedId(venue.events[0]?.id ?? null);
    setExpanded(true);
  }

  function backToList() {
    setMode({ kind: "list" });
    setSelectedId(null);
  }

  // Filters changed: a venue panel may now be stale; the plan panel is independent of the list and stays.
  useEffect(() => {
    setMode((m) => (m.kind === "venue" || m.kind === "venues" ? { kind: "list" } : m));
  }, [events]);

  // Keep the selected card in view when a pin is tapped.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const count = status === "done" ? `${shown.length} evento${shown.length === 1 ? "" : "s"}` : "Buscando…";

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
        <h2 className="no-caps text-lg font-bold leading-tight">{humanizeTitle(venue.name)}</h2>
        {venue.address && <p className="text-sm text-muted-foreground">{humanizeTitle(venue.address)}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button asChild size="sm">
            <a href={directions(venue)} target="_blank" rel="noopener noreferrer">
              Cómo llegar
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">
            {venue.events.length} evento{venue.events.length === 1 ? "" : "s"}
            {me && distanceLabel(me, venue) && ` · ${distanceLabel(me, venue)}`}
          </span>
        </div>
      </div>
      {venueGroups(venue).map((g) => (
        <section key={g.label} aria-label={g.label} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
          <ul className="space-y-3">
            {g.events.map((e) => (
              <li key={e.id}>
                <Link href={`/evento/${e.id}`} className="surface tap row-in block space-y-1 p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-tertiary">{formatWhen(e)}</span>
                  <span className="no-caps line-clamp-2 block text-[15px] font-semibold leading-snug">{displayTitle(e)}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{humanizeTitle(venue.name)}</span>
                  <span className="flex items-center gap-1.5 pt-0.5">
                    {hasPrice(e.price) && <Badge variant={e.price?.free ? "success" : "secondary"}>{formatPrice(e.price)}</Badge>}
                    <Badge variant="outline" className="gap-1.5">
                      <CategoryIcon category={e.category} className="size-3.5" style={{ color: CATEGORY_COLORS[e.category] }} />
                      {CATEGORY_LABELS[e.category]}
                    </Badge>
                  </span>
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
      <ul className="space-y-3">
        {venues.map((v) => (
          <li key={v.key}>
            <button
              type="button"
              onClick={() => openVenue(v)}
              className="surface tap row-in flex w-full items-center gap-3 p-3 text-left"
            >
              {v.mixed ? (
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={STACK_ICON_PATH} />
                </svg>
              ) : (
                <CategoryIcon category={v.category} className="size-4 shrink-0" style={{ color: CATEGORY_COLORS[v.category] }} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{humanizeTitle(v.name)}</span>
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
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]">
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
              className={cn("tap rounded-full px-2.5 py-1 text-[13px] font-medium", sort === v ? "bg-white/12 text-foreground" : "text-muted-foreground hover:bg-accent")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const list = (
    <div ref={listRef} className="space-y-6">
      {status === "loading" && events.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}
      {status === "error" && (
        <div className="surface p-6 text-center">
          <p className="text-[15px] font-semibold">No pudimos cargar los eventos.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Probá de nuevo en un momento.</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )}
      {status === "done" && shown.length === 0 && (
        <div className="surface p-6 text-center">
          <p className="text-[15px] font-semibold">No hay nada con esos filtros.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Sacá uno o probá otro día.</p>
        </div>
      )}
      {groups.map(([key, g]) => {
        const first = g.events[0];
        const dayTitle = sort === "views" ? g.label : formatWhenLong(first).split(" · ")[0];
        return (
          <section key={key} aria-label={g.label} className="relative isolate">
            <h2 className="sticky top-0 z-20 -mx-3 mb-2 flex items-center justify-between border-b border-white/8 bg-background px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.06em]">
              <span>{dayTitle}</span>
              <span className="text-muted-foreground">
                {g.events.length} evento{g.events.length === 1 ? "" : "s"}
              </span>
            </h2>
            {sort === "views" ? (
              <div className="space-y-2 pt-1">
                {g.events.map((e, i) => (
                  <EventCardEditorial key={e.id} event={e} index={i} selected={e.id === selectedId} onSelect={selectFromList} />
                ))}
              </div>
            ) : (
              hourGroups(g.events).map((h) => (
                <div key={h.key} className="flex border-t border-white/8 first:border-t-0">
                  <div className="w-12 shrink-0 pt-2.5">
                    {h.unknown ? (
                      <span className="block text-[11px] font-semibold leading-tight text-muted-foreground">a confirmar</span>
                    ) : (
                      <>
                        <b className="block text-[22px] font-extrabold leading-none tracking-[-0.02em]">{h.hour}</b>
                        <small className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">:{h.minutes}</small>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 border-l border-white/[0.14] pl-3">
                    {h.events.map((e, i) => (
                      <div key={e.id} className="relative py-1 first:pt-2 last:pb-2">
                        <span aria-hidden className="absolute -left-[16px] top-4 size-[7px] rounded-full bg-muted-foreground" />
                        <EventCardEditorial event={e} index={i} selected={e.id === selectedId} onSelect={selectFromList} showTime={!h.unknown && formatTime(e.startsAt) !== `${h.hour}:${h.minutes}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );


  const parsed = parsePlan(ai.text, ai.status === "done");
  const stops = ai.status === "done" && parsed.mode === "text" ? parseStops(ai.text) : [];
  const resolveStop = (s: { eventId?: string; shortTitle: string; venueName: string }) => {
    const hit = (s.eventId && events.find((e) => e.id === s.eventId)) || events.find((e) => norm(displayTitle(e)) === norm(s.shortTitle));
    return hit ? { id: hit.id, category: hit.category } : undefined;
  };
  const planPanel = (
    <div className="space-y-3">
      <button type="button" onClick={backToList} className="flex h-11 items-center text-sm text-muted-foreground hover:underline">
        ← Todos los eventos
      </button>
      {parsed.mode !== "text" ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tu plan</h2>
            {ai.mode === "mock" && <Badge variant="warning">mock</Badge>}
          </div>
          {ai.status === "error" ? (
            <AIResult title="Tu plan" status={ai.status} text="" error={ai.error} mode={ai.mode} onRetry={() => ai.run({ when: day ?? "hoy", lat: me?.lat, lng: me?.lng, budget: budget ?? undefined })} />
          ) : (
            <PlanView plan={parsed} status={ai.status} resolve={resolveStop} onPick={(s) => showStopOnMap({ title: s.shortTitle, venue: s.venueName })} />
          )}
        </>
      ) : (
      <AIResult
        title="Tu plan"
        status={ai.status}
        text={ai.text}
        error={ai.error}
        mode={ai.mode}
        onRetry={() => ai.run({ when: day ?? "hoy", lat: me?.lat, lng: me?.lng, budget: budget ?? undefined })}
        className="min-h-32"
      />
      )}
      {parsed.mode === "text" && stops.length > 0 && <PlanStops stops={stops} onPick={showStopOnMap} />}
      {parsed.mode === "text" && ai.status === "done" && ai.text.trim() && <WhatsAppButton text={ai.text} className="w-full" />}
    </div>
  );

  const body =
    mode.kind === "venue" ? venuePanel(mode.venue) : mode.kind === "venues" ? venuesPanel(mode.venues) : mode.kind === "plan" ? planPanel : list;

  return (
    <div className="relative flex flex-col overflow-hidden md:flex-row">
      <TileCache />
      {/* Map: the whole viewport on phones; the sheet slides over it. */}
      <div className="relative h-dvh shrink-0 md:flex-1">
        <EventMap
          events={shown}
          selectedId={selectedId}
          onSelectVenue={openVenue}
          onSelectCluster={(vs) => {
            setMode({ kind: "venues", venues: vs });
            setExpanded(true);
          }}
          fit={status === "done" && mode.kind === "list"}
          explore
          onLocate={setMe}
        />
        {!embed && (
          <Link
            href="/"
            aria-label="HayPlan, inicio"
            className="tap absolute left-4 top-4 z-[1001] flex items-center text-white [filter:drop-shadow(0_1px_8px_rgba(0,0,0,0.6))]"
          >
            <Logo className="h-7 w-auto" />
          </Link>
        )}
        <ConciergeBar
          day={day}
          onDay={setDay}
          budget={budget}
          onBudget={setBudget}
          near={near}
          onNear={toggleNear}
          locating={locating}
          busy={ai.status === "loading" || ai.status === "streaming"}
          autoFocus={focusBar}
          onSubmit={askConcierge}
          className={cn("absolute left-3 right-3 z-[1000] [touch-action:pan-x_pan-y] md:top-16 md:mx-auto md:max-w-[880px]", embed ? "top-3" : "top-14")}
        />
        <BarrioStrip
          events={shown}
          range={range}
          active={query}
          onPick={(b) => {
            setQuery(b);
            setQ(b);
          }}
          className="absolute left-[132px] right-3 top-3 z-[1000] hidden pr-14 [mask-image:linear-gradient(to_right,black_calc(100%-5.5rem),transparent_calc(100%-3rem))] md:flex"
        />
      </div>

      {/* Desktop side panel */}
      <aside className="glass hidden h-dvh w-96 flex-col [touch-action:pan-y] md:flex" aria-label="Lista de eventos">
        {mode.kind === "list" && <div className="space-y-2 border-b p-3">{filters}</div>}
        <div className="relative min-h-0 flex-1 overflow-y-auto p-3">{body}</div>
      </aside>

      {/* Phones: pill that opens the list */}
      {!embed && (
        <button
          type="button"
          onClick={() => {
            setMode({ kind: "list" });
            setExpanded(true);
          }}
          aria-expanded={expanded}
          aria-controls="hp-sheet"
          className={cn(
            "tap absolute bottom-6 left-1/2 z-[1050] flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 text-[15px] font-semibold text-background shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-200 md:hidden",
            expanded && "pointer-events-none translate-y-4 opacity-0",
          )}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          {status === "done" ? `Ver ${shown.length} evento${shown.length === 1 ? "" : "s"}` : "Ver eventos"}
        </button>
      )}

      {/* Phones: bottom sheet overlay (85%), swipe down or X closes */}
      <section
        id="hp-sheet"
        aria-label="Lista de eventos"
        aria-hidden={!expanded}
        className={cn(
          "glass absolute inset-x-0 bottom-0 z-[1100] flex h-[85%] min-h-0 flex-col rounded-t-[20px] shadow-[0_-8px_32px_rgba(0,0,0,0.35)] transition-transform duration-[320ms] [touch-action:pan-y] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] md:hidden",
          expanded ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="relative flex shrink-0 items-center justify-center pb-1 pt-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            onPointerDown={onHandlePointerDown}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={() => (dragStart.current = null)}
            aria-label="Cerrar la lista"
            className="flex h-8 w-24 touch-none select-none items-center justify-center"
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-white/25" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Cerrar"
            className="tap absolute right-3 top-2 flex size-9 items-center justify-center rounded-full bg-white/8 text-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {mode.kind === "list" && <div className="space-y-2 px-3 pb-2">{filters}</div>}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-6">{body}</div>
      </section>
    </div>
  );
}
