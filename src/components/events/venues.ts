import type { Event, EventCategory } from "@/lib/events/schema";
import { haversineMeters } from "./format";

export type Venue = {
  key: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  /** Dominant category (for lists); `mixed` is true when the venue holds more than one category. */
  category: EventCategory;
  mixed: boolean;
  events: Event[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** One venue per name (or per spot within 25 m). Events without coordinates are left out of the map. */
export function groupByVenue(events: Event[]): Venue[] {
  const venues: Venue[] = [];
  const byName = new Map<string, Venue>();
  for (const e of events) {
    if (e.lat == null || e.lng == null) continue;
    const nameKey = norm(e.venueName);
    let v = nameKey ? byName.get(nameKey) : undefined;
    if (!v) v = venues.find((x) => haversineMeters(x, { lat: e.lat!, lng: e.lng! }) <= 25);
    if (!v) {
      v = { key: nameKey || `${e.lat.toFixed(5)},${e.lng.toFixed(5)}`, name: e.venueName, address: e.address, lat: e.lat, lng: e.lng, category: e.category, mixed: false, events: [] };
      venues.push(v);
      if (nameKey) byName.set(nameKey, v);
    }
    v.events.push(e);
    v.address ??= e.address;
  }
  for (const v of venues) {
    v.events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    v.category = dominant(v.events);
    v.mixed = new Set(v.events.map((e) => e.category)).size > 1;
  }
  return venues;
}

function dominant(events: Event[]): EventCategory {
  const count = new Map<EventCategory, number>();
  for (const e of events) count.set(e.category, (count.get(e.category) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function venueOf(venues: Venue[], eventId: string | null | undefined): Venue | undefined {
  if (!eventId) return undefined;
  return venues.find((v) => v.events.some((e) => e.id === eventId));
}
