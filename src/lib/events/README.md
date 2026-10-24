# Events pipeline (HayPlan backend)

1. **Inputs** (git-ignored, owned by `datos`): `data/private/raw/*.json` as `RawEvent[]` and `data/private/tiktok-rosario.json`, the radar export of TikTok/Instagram captions (`{ url, fecha, poi, descr, handle }`).
2. **`npm run build-events`** (`scripts/build-events.ts`, plain Node with `scripts/ts-loader.mjs` stripping types):
   - validates every raw event with `RawEventSchema`;
   - `extract.ts` sends captions to Claude in batches of 20 (`completeJSON` + `zodOutputFormat`) and keeps only concrete, upcoming events; skipped when `ANTHROPIC_API_KEY` is missing;
   - `geocode.ts` resolves missing coordinates through Georef (street + number only), caching in `data/private/geocache.json`;
   - `normalize.ts` builds the `fingerprint` (title without stopwords | date | first word of venue) and `mergeEvents` fuses duplicates, keeping the richest fields and every source URL in a `Fuentes:` footer;
   - past events and anything outside `ROSARIO_BBOX` are dropped, ids are `<sourceType>-<hash>`, output goes to `data/events.json` sorted by `startsAt`. With no inputs the file is left untouched.
3. **Runtime store** (`store.ts`): SQLite table `events` (one column per field, indexes on `starts_at`, `status`, `category`, `fingerprint`) via `getStore()`, or an in-memory map when `node:sqlite` is unavailable. An empty store seeds itself from `data/events.json`, so Vercel (`/tmp`, ephemeral) always has data.
4. **Routes** (`src/app/api`): `GET /api/events` (filters: from, to, category, q, bbox, status, limit), `GET /api/events/:id`, `POST /api/events` (pending), `POST /api/flyer` (Claude vision -> draft + duplicates), `POST /api/concierge` (streamed picks from the store), `POST /api/ingest` (`x-ingest-key` = `INGEST_KEY`, upsert by fingerprint).
5. **Prompts** live in `src/lib/prompts.ts`; time helpers (Rosario is always -03:00) in `time.ts`; concierge windows/ranking in `concierge.ts`.

Run locally: `npm run build-events && npm run dev`. Env: `ANTHROPIC_API_KEY` (else mock mode), `INGEST_KEY` for ingest, `DB_PATH` to move the SQLite file.
