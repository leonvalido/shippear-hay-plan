/**
 * Recurring nightclub nights from data/boliches.json: one RawEvent per venue per regular
 * night in the next 14 days (placeholder title the AI rewrites, `recurring: true`).
 * Each venue is enriched once with Google Places (New) using GOOGLE_PLACES_KEY from
 * .env.local (main checkout or worktree; never printed): the result is cached in
 * data/private/places/<slug>.json and feeds sourceUrl, links, meta (rating) and a
 * `context` string (editorial summary + top reviews) for the description step.
 * Venues with no days in the file and no opening hours from Places are skipped.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, toIso, rosarioToday, inRosario, normalizeEvent, writeRaw, clean, stripAccents, sleep } from "./lib.mjs";

const VENUES = JSON.parse(readFileSync(join(ROOT, "data", "boliches.json"), "utf8")).venues;
const PLACES_DIR = join(ROOT, "data", "private", "places");
const DAYS_AHEAD = 14;
const DAY_INDEX = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
const DAY_NAME = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const FIELDS = "displayName,formattedAddress,location,websiteUri,rating,userRatingCount,regularOpeningHours,reviews,editorialSummary,googleMapsUri";

const slug = (s) => stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function placesKey() {
  if (process.env.GOOGLE_PLACES_KEY) return process.env.GOOGLE_PLACES_KEY;
  for (const f of [join(ROOT, ".env.local"), resolve(ROOT, "..", "..", "..", ".env.local")]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^GOOGLE_PLACES_KEY=["']?([^"'\n]+)/m);
    if (m) return m[1].trim();
  }
  return null;
}

/** Google Places (New) lookup, cached per venue. Returns null when unavailable. */
async function placeFor(venue, key) {
  mkdirSync(PLACES_DIR, { recursive: true });
  const file = join(PLACES_DIR, `${slug(venue.name)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  if (!key) return null;
  const headers = { "Content-Type": "application/json", "X-Goog-Api-Key": key };
  try {
    const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { ...headers, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress" },
      body: JSON.stringify({ textQuery: `${venue.name} ${venue.address ?? ""} Rosario Santa Fe`, languageCode: "es", regionCode: "AR", locationBias: { circle: { center: { latitude: -32.9468, longitude: -60.6393 }, radius: 15000 } } }),
    });
    if (!search.ok) throw new Error(`searchText HTTP ${search.status}`);
    const id = (await search.json()).places?.[0]?.id;
    if (!id) { writeFileSync(file, "null"); return null; }
    await sleep(300);
    const details = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=es&regionCode=AR`, { headers: { ...headers, "X-Goog-FieldMask": FIELDS } });
    if (!details.ok) throw new Error(`details HTTP ${details.status}`);
    const place = await details.json();
    writeFileSync(file, JSON.stringify(place, null, 1));
    return place;
  } catch (e) {
    console.warn(`  places: ${venue.name}: ${e.message}`);
    return null;
  }
}

/** Nights from the file: [{ day, opens, closes }] ("feriados" is ignored). */
function nightsFromFile(venue) {
  if (!Array.isArray(venue.days)) return [];
  return venue.days.filter((d) => DAY_INDEX[d] != null).map((d) => ({ day: DAY_INDEX[d], opens: venue.opens ?? "00:00", closes: venue.closes ?? "06:00" }));
}

/** Nights from Places regularOpeningHours periods (day 0 = Sunday): only periods that run into the night. */
function nightsFromPlaces(place) {
  const periods = place?.regularOpeningHours?.periods ?? [];
  const isNight = (p) => p.close.day !== p.open.day || (p.close.hour ?? 0) >= 23 || (p.open.hour ?? 0) >= 20;
  // a restaurant-bar open from noon still gets its "night" from 21:00
  return periods.filter((p) => p.open && p.close && isNight(p)).map((p) => ({
    day: p.open.day,
    opens: (p.open.hour ?? 0) >= 6 && (p.open.hour ?? 0) < 21 ? "21:00" : `${String(p.open.hour ?? 0).padStart(2, "0")}:${String(p.open.minute ?? 0).padStart(2, "0")}`,
    closes: `${String(p.close.hour ?? 0).padStart(2, "0")}:${String(p.close.minute ?? 0).padStart(2, "0")}`,
    closeDay: p.close.day,
  }));
}

/** Dates in the next DAYS_AHEAD days that fall on a weekday. An opening before 06:00 belongs to the night after that weekday. */
function occurrences(night, now) {
  const { y, m, d } = rosarioToday(now);
  const [oh, om] = night.opens.split(":").map(Number);
  const [ch, cm] = night.closes.split(":").map(Number);
  const lateOpen = oh < 6;
  const out = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    if (day.getUTCDay() !== night.day) continue;
    const start = new Date(Date.UTC(y, m - 1, d + i + (lateOpen ? 1 : 0)));
    const end = new Date(start.getTime() + (ch < oh || (ch === oh && cm <= om) ? 86_400_000 : 0));
    out.push({
      label: DAY_NAME[night.day],
      startsAt: toIso(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), oh, om),
      endsAt: toIso(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), ch, cm),
    });
  }
  return out;
}

/** A Places hit counts only when its address shares the street named in the file (when the file has one). */
function placeMatches(venue, place) {
  if (!place) return false;
  if (!venue.address) return true;
  const street = stripAccents(venue.address.toLowerCase()).replace(/\b(av|avda|avenida|bv|blvd|bulevar|pasaje|pje)\.?\s+/g, "").split(/[\s,]+/).find((w) => w.length > 3 && !/^\d+$/.test(w));
  return !street || stripAccents(`${place.formattedAddress ?? ""} ${place.displayName?.text ?? ""}`.toLowerCase()).includes(street);
}

export async function run(now = new Date()) {
  const key = placesKey();
  if (!key) console.warn("boliches-recurrentes: GOOGLE_PLACES_KEY not found; using cached places only");
  const events = [];
  const perVenue = {};
  for (const venue of VENUES) {
    const found = await placeFor(venue, key);
    const place = placeMatches(venue, found) ? found : null;
    if (found && !place) console.warn(`  places: ${venue.name}: hit "${found.formattedAddress}" does not match "${venue.address}", ignored`);
    const nights = nightsFromFile(venue).length ? nightsFromFile(venue) : nightsFromPlaces(place);
    if (nights.length === 0) { perVenue[venue.name] = 0; continue; }
    const reviews = (place?.reviews ?? []).slice(0, 5).map((r) => clean(r.text?.text ?? r.originalText?.text ?? "")).filter(Boolean);
    const context = [clean(place?.editorialSummary?.text), venue.music && `Música: ${venue.music}`, venue.notes, ...reviews.map((r) => `Reseña: ${r}`)].filter(Boolean).join("\n").slice(0, 4000) || undefined;
    const lat = place?.location?.latitude, lng = place?.location?.longitude;
    let n = 0;
    for (const night of nights) {
      for (const occ of occurrences(night, now)) {
        const ev = normalizeEvent({
          title: `${venue.name}: noche de ${occ.label}`,
          description: venue.music ? `${venue.type ?? "boliche"} · ${venue.music}` : undefined,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          venueName: venue.name,
          address: venue.address ?? (clean(place?.formattedAddress) || undefined),
          lat: inRosario(lat, lng) ? lat : undefined,
          lng: inRosario(lat, lng) ? lng : undefined,
          category: "fiesta",
          sourceType: "platform",
          sourceName: venue.name,
          sourceUrl: place?.websiteUri || undefined,
          links: place?.googleMapsUri ? [{ label: "Google Maps", url: place.googleMapsUri }] : undefined,
        });
        if (!ev) continue;
        // fields the schema does not know yet (api is adding `recurring`; `meta`/`context` are mapped by api)
        events.push({ ...ev, recurring: true, meta: place ? { rating: place.rating, userRatingCount: place.userRatingCount, placeName: place.displayName?.text } : undefined, context });
        n++;
      }
    }
    perVenue[venue.name] = n;
  }
  console.log("boliches-recurrentes per venue:", JSON.stringify(perVenue));
  return events;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("boliches-recurrentes", await run());
}
