# Event sources (datos)

Produced by `npm run ingest` (`scripts/ingest/all.mjs`), which runs every source concurrently
(one request per second per host), writes `data/private/raw/<source>.json` as `RawEvent[]` and a
`data/private/raw/_summary.json` with counts and errors. Everything under `data/private/` is
git-ignored. Only events dated today … today + 15 days are kept; coordinates outside
`ROSARIO_BBOX` are dropped (the event is kept without them).

Last run: 2026-10-24 11:37 (Rosario), 203 s, 144 events, 0 errors.

| Source | Script | sourceType | What it gives | Quirks | Last count |
|---|---|---|---|---|---|
| Municipalidad de Rosario agenda (rosario.gob.ar/agenda/buscar) | `municipal.mjs` | `municipal` | Title, date or date range, tag, image, venue name + address + exact coordinates (from the "Cómo llego" link), schedule rule text, free/paid when stated | Drupal listing, ~28 pages; each card needs its detail page (160 max, ~3 min). Ongoing exhibitions get `startsAt` = today at the parsed hour and `endsAt` = range end; recurring workshops show as one event. Discounts ("Club de los grandes") are skipped. Time missing on ~1/3 (00:00). | 130 (129 geocoded) |
| Entradauno / TurboEntrada | `entradauno.mjs` | `ticketing` | Big shows (Metropolitano, Alto Shopping, Autódromo…): title, next function date-time, venue + address + coordinates (from the venue's Google Maps embed), image, link to the ticket landing | Two public JSON endpoints (`/v2/Cartelera`, `/v2/EspectaculosCartel`, ~4 MB). No prices in the payload. One event per show (next function only). | 6 |
| Eventbrite (eventbrite.com.ar, Rosario city page) | `eventbrite.mjs` | `platform` | Title, exact start/end, venue + coordinates, image, ARS price (from the event page JSON-LD) | Listing JSON-LD has date only; 1 extra request per event for the time. Online events are dropped; foreign-currency prices ignored. | 6 (5 geocoded) |
| Meetup (meetup.com/find, Rosario) | `meetup.mjs` | `platform` | In-person community events: title, date-time, venue + address, group, image; free unless fee | Apollo cache inside `__NEXT_DATA__`; mostly online events in Rosario, only 2 physical in the window. Addresses geocoded via Georef then Nominatim (cached in `data/private/geocache.json`). | 2 |
| Luma (api.lu.ma discover feed) | `luma.mjs` | `platform` | Would give title, time, coordinates, cover | No Rosario place on Luma; the Argentina feed is paged (5 × 100) and filtered by city/bbox. Returned 0 today, kept for when something appears. | 0 |
| Passline | — | `ticketing` | — | **Failed**: every URL (home, listings, sitemap) answers 403 to curl/fetch with browser or mobile User-Agents. Needs a real browser; not worth it offline. | — |
| Venti | — | `ticketing` | — | **Failed**: venti.com.ar / venti.live are an empty SPA shell plus a Framer site; the events live in the mobile app's private API (not discoverable in the bundle). | — |
| Ticketek Argentina | — | `ticketing` | — | **Failed**: Angular shell; the prerendered (Googlebot) page has title and venue but no date; the CMS API (`prod-cms-api.ticketek.com.ar`) is 403. Sitemap lists 62 Rosario show URLs if someone wants to retry with a headless browser. | — |
| Centro Cultural Parque de España, La Comedia, museums | (via municipal) | `municipal` | Their activities appear in the municipal agenda above (CCPE, Museo de la Memoria, Castagnino, Fontanarrosa, Biblioteca Argentina…). | No separate scrape needed. | included |

## Re-running

```bash
npm run ingest              # all sources, ~3.5 min, idempotent
npm run ingest -- meetup    # just one or more sources
```

Categories come from keyword rules in `lib.mjs` (`guessCategory`), with a per-source fallback
(municipal → `cultura`, Entradauno → `musica`, Meetup → `charla`).
