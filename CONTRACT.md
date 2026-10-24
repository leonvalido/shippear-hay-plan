# HayPlan — team contract (Shippear #3, 2026-10-24)

Working name: **HayPlan**: the events map of Rosario. Events are pulled from public sources and social
media signals (a private TikTok/Instagram collector feeds captions; it is never in this repo), Claude extracts,
deduplicates and recommends. **The flyer-upload feature was cancelled at 12:30**: no `/subir`, no `/api/flyer`.

## Who owns what (no session edits another's files)

| Area | Owner | Files |
|---|---|---|
| Contract | coordinator only | `src/lib/events/schema.ts`, this file |
| Data ingestion | **datos** | `scripts/ingest/**`, `data/private/**` (git-ignored), `data/sources.md` |
| Backend + AI | **api** | `src/app/api/**`, `src/lib/**` except `schema.ts`, `scripts/build-events.ts`, `data/events.json` |
| Web | **web** | `src/app/**` except `src/app/api/**`, `src/components/**`, `src/hooks/**`, `src/app/globals.css` |

`package.json`: datos may add `cheerio` (dev); nobody else adds dependencies. Maps use Leaflet from a CDN.

## Data flow

1. `datos` writes one JSON per source to `data/private/raw/<source>.json` as `RawEvent[]` (schema.ts). Radar's TikTok/Instagram export lands at `data/private/tiktok-rosario.json`.
2. `api` runs `npm run build-events`: reads everything under `data/private/`, extracts events from social captions with Claude, geocodes, deduplicates by `fingerprint`, writes `data/events.json` (`Event[]`, committed: it ships with the deploy and seeds SQLite on first request).
3. `web` reads only the API below.

## API (stubs exist on main; `api` replaces their bodies, never their shapes)

- `GET /api/events?from&to&category&q&bbox&status&limit` → `{ events: Event[] }` (defaults: from=now, to=+14d, status=published, limit=200)
- `GET /api/events/:id` → `{ event }` | 404
- `POST /api/events` body `RawEvent` → `{ event }` with `status: "pending"` (201)
- `GET /api/events/stats?from&to` → `{ total, byBarrio: [{ barrio, count }], byCategory: [{ category, count }] }` (sorted by count desc)
- `POST /api/concierge` JSON `{ when, lat?, lng?, budget?, mood? }` → `text/plain` stream, header `x-ai-mode`
- `POST /api/ingest` header `x-ingest-key` body `{ events: RawEvent[] }` → `{ inserted, merged, skipped }`

Everything must work with no API key (mock mode) and on a phone screen. Vercel: SQLite lives in `/tmp` (ephemeral) and is seeded from `data/events.json`.

## Features added at 12:40 (all five approved)

1. **Plan de la noche**: the concierge answers with a 2–3 stop plan (hour · event · venue · price) and the web shows a
   "Mandar por WhatsApp" button (`https://wa.me/?text=<plan + link to /mapa>`). Owner: api (answer format), web (button).
2. **Visto en TikTok**: events with `sourceType` tiktok/instagram show a badge with `sourceName` (handle) and
   `metrics.views`; list gets a sort "lo que más se mueve". Owner: api (fill `metrics` in extraction), web (badge, sort).
3. **Pulso de barrios**: strip on top of the map with event counts per barrio from `GET /api/events/stats`.
   Owner: api (endpoint), web (strip; tapping a barrio filters the list by `q`).
4. **Preguntar por voz**: microphone button on `/hoy` using the browser `SpeechRecognition` API (`es-AR`), fills the
   "ganas de..." field and submits. Owner: web. Graceful hide when unsupported.
5. **A N minutos caminando**: when geolocation is granted, each card shows walking minutes (haversine distance / 80 m per
   minute). Owner: web only.

## Team status (coordinator keeps this current)

Sessions on separate branches: `datos` (ingestion scripts), `api` (backend), `web` (UI), `brand` (brand kit under `brand/`).
A teammate working from a fork opens pull requests against `main`; the coordinator merges and Vercel redeploys
https://shippear-starter.vercel.app on every push to `main`. Deadline 15:30; feature freeze 14:30.
