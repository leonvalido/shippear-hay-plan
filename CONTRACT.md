# HayPlan — team contract (Shippear #3, 2026-10-24)

Working name: **HayPlan**: the events map of Rosario. Events are pulled from public sources and social
media signals, people add flyers from their phones, Claude reads, deduplicates and recommends.

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
- `POST /api/flyer` multipart `image` (+ `caption`) or JSON `{ imageBase64, mediaType, caption? }` → `{ draft: RawEvent, confidence, duplicates: Event[], mode }`
- `POST /api/concierge` JSON `{ when, lat?, lng?, budget?, mood? }` → `text/plain` stream, header `x-ai-mode`
- `POST /api/ingest` header `x-ingest-key` body `{ events: RawEvent[] }` → `{ inserted, merged, skipped }`

Everything must work with no API key (mock mode) and on a phone screen. Vercel: SQLite lives in `/tmp` (ephemeral) and is seeded from `data/events.json`.
