import { headers } from "next/headers";
import type { Event } from "@/lib/events/schema";

/** Absolute origin of this deployment, for server-side calls to our own API routes. */
export async function apiBase(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function fetchEvent(id: string): Promise<Event | null> {
  try {
    const res = await fetch(`${await apiBase()}/api/events/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { event: Event }).event;
  } catch {
    return null;
  }
}

export async function fetchEvents(params: Record<string, string> = {}): Promise<Event[]> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${await apiBase()}/api/events${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    if (!res.ok) return [];
    return ((await res.json()) as { events: Event[] }).events;
  } catch {
    return [];
  }
}
