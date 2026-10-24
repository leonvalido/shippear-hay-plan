/**
 * Meetup: the public "find events near Rosario" page embeds its Apollo cache in
 * __NEXT_DATA__ with ~25 upcoming in-person events, venue name and address.
 * Addresses are geocoded (Georef, then Nominatim).
 */
import * as cheerio from "cheerio";
import { fetchText, geocode, inWindow, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";

const URLS = [
  "https://www.meetup.com/find/?location=ar--Rosario&source=EVENTS&eventType=inPerson",
  "https://www.meetup.com/find/?location=ar--Rosario&source=EVENTS",
];

export async function run(now = new Date()) {
  const state = {};
  for (const url of URLS) {
    const $ = cheerio.load(await fetchText(url));
    const raw = $("#__NEXT_DATA__").html();
    if (!raw) throw new Error(`no __NEXT_DATA__ on ${url}`);
    Object.assign(state, JSON.parse(raw).props?.pageProps?.__APOLLO_STATE__ ?? {});
  }

  const events = [];
  for (const [key, e] of Object.entries(state)) {
    if (!key.startsWith("Event:") || !e.title || !e.dateTime) continue;
    if (e.eventType !== "PHYSICAL" || !e.venue?.name) continue;
    if (!inWindow(e.dateTime, now)) continue;
    const venueName = clean(e.venue.name).replace(/\s*\|\s*Rosario$/i, "");
    const street = clean(e.venue.address).split(",")[0];
    const geo = await geocode(venueName, street);
    const group = e.group?.__ref ? state[e.group.__ref] : null;
    const photo = e.featuredEventPhoto?.__ref ? state[e.featuredEventPhoto.__ref] : null;
    const ev = normalizeEvent({
      title: e.title,
      description: e.description,
      startsAt: e.dateTime,
      venueName,
      address: clean(e.venue.address) || undefined,
      lat: geo?.lat,
      lng: geo?.lng,
      category: guessCategory(`${e.title} ${group?.name ?? ""}`, "charla"),
      price: e.feeSettings ? undefined : { free: true, currency: "ARS" },
      sourceType: "platform",
      sourceName: group?.name ? `Meetup · ${group.name}` : "Meetup",
      sourceUrl: e.eventUrl,
      imageUrl: photo?.highResUrl,
    });
    if (ev) events.push(ev);
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("meetup", await run());
}
