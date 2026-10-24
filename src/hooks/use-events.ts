"use client";

import { useEffect, useState } from "react";
import type { Event, EventCategory } from "@/lib/events/schema";

export type EventsFilter = {
  from?: string;
  to?: string;
  category?: EventCategory | null;
  q?: string;
};

export type EventsStatus = "loading" | "done" | "error";

/** Fetches GET /api/events whenever the filter changes; aborts stale requests. */
export function useEvents(filter: EventsFilter) {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<EventsStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(filter);

  useEffect(() => {
    const f: EventsFilter = JSON.parse(key);
    const params = new URLSearchParams();
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    if (f.category) params.set("category", f.category);
    if (f.q?.trim()) params.set("q", f.q.trim().slice(0, 100));
    const ac = new AbortController();
    setStatus("loading");
    setError(null);
    fetch(`/api/events?${params}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
        return res.json() as Promise<{ events: Event[] }>;
      })
      .then((data) => {
        setEvents([...data.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        setStatus("done");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message || "No se pudieron cargar los eventos");
        setStatus("error");
      });
    return () => ac.abort();
  }, [key, tick]);

  return { events, status, error, refetch: () => setTick((t) => t + 1) };
}
