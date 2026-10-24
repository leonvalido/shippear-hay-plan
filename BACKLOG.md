# HayPlan backlog

Single registry of features. Production (Vercel) is at HEAD (see git log), Vercel Pro since 2026-10-24 15:30; everything in main is deployed.

| Item | Owner session | Status | Live since (commit) |
|---|---|---|---|
| Event schema, API stubs, contract | api | done/live | f4611b6 |
| GET /api/events and /api/events/:id | api | done/live | 0087777 |
| POST /api/events and /api/ingest | api | done/live | 0087777 |
| GET /api/events/stats | api | done/live | 53bac52 |
| Concierge stream (/api/concierge) | api | done/live | 0087777 |
| Build pipeline (build-events, events.json) | api | done/live | b898d27 |
| Seed: 396 events, boliches nights, Places ratings, prices | api + datos + analisis | done/live | 698baf7 |
| Vibe field (music, crowd, dress, age) on nightlife events | api | done/live | 19159d1 |
| Claude extraction from social captions | api | done/live | f057917 |
| Event store on SQLite seeded from events.json | api | done/live | aac242f |
| Plan de la noche (2-3 stop plan) | api | done/live | 53bac52 |
| Plan streamed as NDJSON stop cards | web | done/live | 527e261 |
| Mandar por WhatsApp button | web | done/live | d5805f0 |
| Visto en TikTok badge and sort | web | done/live | 2810c12 |
| Social metrics in extraction | api | done/live | 53bac52 |
| Pulso de barrios strip | web | done/live | af6b952 |
| Preguntar por voz (mic on /hoy) | web | done/live | 72cd3ae |
| Mic (voice input) fix | web | done/live | 0f323b3 |
| A N minutos caminando on cards | web | done/live | f30f9b9 |
| Raw ingestion library and runner | datos | done/live | a909b1c |
| Source: press (Rosario3 agenda) | datos | done/live | 9c1e419 |
| Source: Alpogo | datos | done/live | 7f8cbdf |
| Source: towns (Funes, Baigorria) | datos | done/live | c865123 |
| Source: saved Venti/Ticketek/Passline pages | datos | done/live | 8d9f0f1 |
| Source: boliches (per-venue events) | datos | done/live | 5f55ab2 |
| Ingest retry on transient fetch errors | datos | done/live | 1eb06ea |
| Seed with radar extractions (352 events) | api | done/live | 2772d64 |
| Gran Rosario bounds | api | done/live | 2c76777 |
| Google Places geocoding | api | done/live | 7328ed5 |
| Venue ratings/websites by confidence | api | done/live | 2b368a3 |
| Descriptive AI short titles | api | done/live | 2f8e0b0 |
| AI descriptions | api | done/live | bf542cf |
| AI categories | api | done/live | c170f16 |
| Cross-time dedupe | api | done/live | c170f16 |
| Official links from official pages | api | done/live | c7c8ece |
| Prices from official pages | api | done/live | 5397c57 |
| Recurring boliches nights with Google Places | api | done/live | c170f16 |
| Rate limits, budget guard, /api/health | api | done/live | ca7b7d1 |
| Map page (Leaflet, pins, sheet) | web | done/live | 7ed34a9 |
| Floating logo and no top bar | web | done/live | b5fc3a2 |
| Floating logo: plain white wordmark | web | done/live | 6a36f21 |
| Hero bar with chips | web | done/live | 799bafd |
| Hero bar: single chip row, 880px desktop | web | done/live | 07a2e28 |
| List behind "Ver N eventos" on phone | web | done/live | d84725a |
| Premium smaller pins and bubbles | web | done/live | d990986 |
| Venue pins keep category icon | web | done/live | 45a9046 |
| Category icons | web | done/live | c595b64 |
| No "Visto en" badge on cards | web | done/live | c595b64 |
| Whole-card tap | web | done/live | c595b64 |
| Event detail page | web | done/live | 4784319 |
| Event detail: editorial hero redesign | web | done/live | 36870c1 |
| Map bounds + caching | web | done/live | 58b6073 |
| Map performance (SSR list, thumbnails) | web | done/live | 8cae6fc |
| List endpoint CDN cache headers | api | done/live | ab47aa7 |
| MapLibre map (/mapa?gl=1) | web-maplibre | done/live | 81c3379 |
| Landing page | web-landing | done/live | 3ce1270 |
| Open Sans desktop landing + phone frame | web-landing | done/live | 299a5df |
| Landing: slim hero, 404 backdrop | web-landing | done/live | 3530384 |
| Share previews (OG/Twitter cards) | web | done/live | 44fb441 |
| Branded 404 and error page | web | done/live | cbab082 |
| Web manifest | web | done/live | edfad9a |
| robots.txt and sitemap | web | done/live | 02a1553 |
| Sitemap absolute URLs | web-landing | done/live | 8bf162b |
| Footer | web | done/live | 4bdf224 |
| Brand kit (logo, tokens, voice) | brand | done/live | 8d21421 |
| Metallic app icon | brand | done/live | c8a45ac |
| Phone mockups: event detail | brand | done/live | fe257c7 |
| Phone mockups: events list | brand | done/live | 65070d4 |
| Demo video v3 | video | done/live | 34aed34 (version unverified) |
| QA fixes (QA 2, 5, 11, 12, 19) | qa | done/live | 44d645c |
| List redesign: editorial 16:9 cards | web | in progress | on origin/claude/web-ui-494abf only (062a450) |
| iOS .ics route, 16px inputs | web | in progress | on origin/claude/web-ui-494abf only (e108cec) |
| iPhone review | qa-iphone | in progress (unverified) | no commits found |
| TikTok/links/prices analysis | analisis | in progress (unverified) | no commits found |
| Merges and Vercel deploys | deploy | done/live | c5b0b8c (Pro plan, cap lifted) |

## How to update
The deploy session updates this table with every merge and deploy, and commits it together with the merge.
Move a row to `done/live` with its commit hash once Vercel serves it; done items stay in the table.
New work gets a new row (`not started` or `in progress`) with its owner session.
