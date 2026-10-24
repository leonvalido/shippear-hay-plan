# Event sources (datos)

Produced by `npm run ingest` (`scripts/ingest/all.mjs`), which runs every source concurrently
(one request per second per host), writes `data/private/raw/<source>.json` as `RawEvent[]` and a
`data/private/raw/_summary.json` with counts and errors. Everything under `data/private/` is
git-ignored. Only events dated today … today + 15 days are kept; coordinates outside
`ROSARIO_BBOX` (Gran Rosario since the 12:30 merge of main) are dropped (the event is kept without them).
Geocoding takes a `localidad` (Funes, San Lorenzo, Granadero Baigorria…); the press parser detects the town named in a paragraph.

Sites that block plain fetches (Venti, Ticketek, Passline, and Alpogo event pages) are parsed from
pages the coordinator saves from a residential connection under `data/private/html/<site>/`
(`index.json` + `<n>.html` / `api-<n>.json`, main checkout; from a worktree the folder is found three
levels up, or set `HAYPLAN_HTML_DIR`). The runner only includes those sources when the folder exists.

Last run: 2026-10-24 14:14 (Rosario), 216 s, 215 events, 0 errors (municipal 131, press 50, alpogo 7, venti 6, eventbrite 6, entradauno 5, ticketek 5, boliches 3, meetup 2, towns 0, luma 0, passline 0).

| Source | Script | sourceType | What it gives | Quirks | Last count |
|---|---|---|---|---|---|
| Municipalidad de Rosario agenda (rosario.gob.ar/agenda/buscar) | `municipal.mjs` | `municipal` | Title, date or date range, tag, image, venue name + address + exact coordinates (from the "Cómo llego" link), schedule rule text, free/paid when stated | Drupal listing, ~28 pages; each card needs its detail page (160 max, ~3 min). Ongoing exhibitions get `startsAt` = today at the parsed hour and `endsAt` = range end; recurring workshops show as one event. Discounts ("Club de los grandes") are skipped. Time missing on ~1/3 (00:00). | 130 (129 geocoded) |
| Rosario3 weekend agenda ("Qué hacemos este fin de semana en Rosario", rosario3.com/ocio) | `press.mjs` | `press` | The big weekend list: recitales, teatro, cine, fiestas, ferias, infantil. Each paragraph has day, hour, title (bold), venue and often the address; free entry when stated | One article per week (Friday); discovered from the home and the Ocio section by URL pattern, with a hard-coded seed URL as fallback. Rule-based paragraph parsing (no AI): "Este sábado a las 21, se presentará **Título**… En el Teatro X (Calle 123)". Friday items drop out once the weekend starts. Venues geocoded by address, then by name (cached). Titles are occasionally the whole sentence when nothing is bold. | 50 (38 geocoded) |
| Alpogo (alpogo.com, search "Rosario") | `alpogo.mjs` | `ticketing` | Independent music and theatre with ARS "desde" prices, image, link; with saved event pages also address, coordinates, exact time and description | Only the search page lists Rosario shows. Live mode has no addresses (one-word venues stay un-geocoded); saved mode (`data/private/html/alpogo`) reads the event pages, falling back to the search card for the date when an event has several functions. | 7 (7 geocoded with saved pages) |
| Venti (saved pages: public events API `api-<n>.json` + event pages) | `venti.mjs` | `ticketing` | Nightlife and electronic music (Switch Club, Zeta Club, Taura…): exact time, venue coordinates from the API, ARS prices and descriptions from the event pages' JSON-LD | Saved-only. ~350 events country-wide in the API dump; filtered by venue coordinates / "Rosario" in the address. Prices only for events whose page was saved. | 6 |
| Ticketek Argentina (saved pages: search by city = Rosario + show pages) | `ticketek.mjs` | `ticketing` | Big theatre and concerts (Teatro El Círculo, Astengo, City Center): one JSON-LD MusicEvent per function with date-time, venue, street address and "desde" price | Saved-only. Pages without "Rosario" in the text are ignored. Addresses geocoded via Georef. | 5 |
| Passline (saved pages) | `passline.mjs` | `ticketing` | Would parse JSON-LD events from real listing pages | Saved-only. All saved pages so far are Cloudflare "Just a moment…" challenges, counted and skipped. | 0 |
| Towns around Rosario (Funes news, Granadero Baigorria WordPress `eventos` + news) | `towns.mjs` | `municipal` | Event-like posts (feria, festival, fiesta, show, taller…) that name an upcoming date; venue geocoded in the right town, else the town centre with the address flagged as approximate | None of the eight town sites publishes a dated agenda. Funes: 8 news items, latest dated event is Ambientar on 27 Nov. Baigorria: `eventos` type last updated May 2025; news are vaccination and waste schedules. San Lorenzo: only ordinances and treasury balances in WordPress; Pérez: static pages, last post 2024; Capitán Bermúdez: Joomla news from 2024; Arroyo Seco: static PHP site; Roldán and Villa Gobernador Gálvez: sites unreachable (connection refused). Posts older than 21 days are skipped; "este viernes" is resolved against the publish date. | 0 |
| Boliches (`data/boliches.json`, 25 nightclubs) | `boliches.mjs` | `ticketing` | Concrete upcoming events per venue, found by matching the venue name against Alpogo's live search and the saved Venti API dump; venue address from the list, or from the ticketing source when the list has none | The list carries no websites or Instagram handles, so those surfaces are not queried. Passline is a bot challenge in every saved page. No Google/serper lookups (a keychain entry named serper may exist; not used without the coordinator's OK). Venues without a concrete event emit nothing: today only Switch Club (3 Venti events). | 3 |
| Entradauno / TurboEntrada | `entradauno.mjs` | `ticketing` | Big shows (Metropolitano, Alto Shopping, Autódromo…): title, next function date-time, venue + address + coordinates (from the venue's Google Maps embed), image, link to the ticket landing | Two public JSON endpoints (`/v2/Cartelera`, `/v2/EspectaculosCartel`, ~4 MB). No prices in the payload. One event per show (next function only). | 6 |
| Eventbrite (eventbrite.com.ar, Rosario city page) | `eventbrite.mjs` | `platform` | Title, exact start/end, venue + coordinates, image, ARS price (from the event page JSON-LD) | Listing JSON-LD has date only; 1 extra request per event for the time. Online events are dropped; foreign-currency prices ignored. | 6 (5 geocoded) |
| Meetup (meetup.com/find, Rosario) | `meetup.mjs` | `platform` | In-person community events: title, date-time, venue + address, group, image; free unless fee | Apollo cache inside `__NEXT_DATA__`; mostly online events in Rosario, only 2 physical in the window. Addresses geocoded via Georef then Nominatim (cached in `data/private/geocache.json`). | 2 |
| Luma (api.lu.ma discover feed) | `luma.mjs` | `platform` | Would give title, time, coordinates, cover | No Rosario place on Luma; the Argentina feed is paged (5 × 100) and filtered by city/bbox. Returned 0 today, kept for when something appears. | 0 |
| Passline (live) | — | `ticketing` | — | **Failed three times** (plain fetch, browser headers with 2 s delay, residential): always a Cloudflare challenge. | — |
| Venti (live) | — | `ticketing` | — | **Failed live**: venti.live is an empty SPA for plain fetches; covered by the saved API dump above. | — |
| Bandsintown (bandsintown.com/c/rosario-argentina) | — | `platform` | — | **Failed**: 403 for browser and Googlebot User-Agents; the REST API refuses unregistered app ids. | — |
| La Capital (lacapital.com.ar) | — | `press` | — | **Not usable**: no weekly agenda article this week (only a theatre roundup from early October); section pages and search are 404. Rosario3 covers the same weekend. | — |
| Ticketek Argentina (live) | — | `ticketing` | — | **Failed live**: Angular shell without dates; the CMS API is 403. Covered by the saved show pages above. | — |
| Centro Cultural Parque de España, La Comedia, museums | (via municipal) | `municipal` | Their activities appear in the municipal agenda above (CCPE, Museo de la Memoria, Castagnino, Fontanarrosa, Biblioteca Argentina…). | No separate scrape needed. | included |

## Re-running

```bash
npm run ingest              # all sources, ~3.5 min, idempotent
npm run ingest -- meetup    # just one or more sources (also venti, ticketek, passline when saved pages exist)
```

Categories come from keyword rules in `lib.mjs` (`guessCategory`), with a per-source fallback
(municipal → `cultura`, Entradauno and Alpogo → `musica`, Venti and Passline → `fiesta`, Ticketek → `teatro`, Meetup → `charla`, press → `otro`).
