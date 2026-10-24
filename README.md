# shippear-hay-plan (HayPlan)

Repo: https://github.com/leonvalido/shippear-hay-plan · Live: https://hayplan.vercel.app

Hackathon boilerplate for Shippear #3 (Rosario, 24 Oct 2026).
**Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Anthropic SDK (streaming) · SQLite built into Node.**

One command to run:

```bash
npm install && npm run dev
```

Open http://localhost:3000. Without an API key it runs in **mock mode** (streamed
canned answer) so the whole UI works offline. Add a key to go live.

## What's in the box

| Path | What it is |
|------|------------|
| `src/app/page.tsx` | Landing: headline, one CTA, three "how it works" cards. Replace copy only. |
| `src/app/app/page.tsx` + `src/components/generate-form.tsx` | The **form → AI → result → saved** flow. Change the fields, keep the shape. |
| `src/app/api/generate/route.ts` | POST, validates with zod, streams `text/plain` from Claude. Header `x-ai-mode: mock\|live`. |
| `src/app/api/items/route.ts` | GET / POST / DELETE on a generic `items` table (JSON `data` column, no migrations). |
| `src/lib/ai.ts` | `streamText()` (stream), `completeJSON()` (schema-validated object via zod), `describeError()`. Mock fallback built in. |
| `src/lib/prompts.ts` | **All prompts in one file.** System prompt, `buildPrompt()`, mock answer. |
| `src/lib/db.ts` | `getStore()` → `node:sqlite` at `data/app.db`, falls back to in-memory if Node < 22.13. |
| `src/hooks/use-stream.ts` | Client hook: `run(body)` → `text`, `status` (idle/loading/streaming/done/error), `abort()`, `reset()`. |
| `src/components/ai-result.tsx` | Reusable result card: skeleton → streaming cursor → done / error with retry. |
| `src/components/ui/*` | shadcn/ui: button, card, input, textarea, label, badge, skeleton, alert. `npx shadcn@latest add dialog` works (components.json is set). |
| `scripts/check-api.mjs` | `npm run check` → one tiny API call, prints latency or the exact error. |
| `IDEAS.md` / `PLAN.md` | Idea bank + hour-by-hour plan, roles, pitch template, packing list. |

Dependencies are deliberately minimal (61 packages, ~17 s install on decent WiFi):
no ESLint, no icon library, no ORM, no auth. Add only what the demo needs.

## Environment

```bash
cp .env.example .env.local
```

| Var | Default | Notes |
|-----|---------|-------|
| `ANTHROPIC_API_KEY` | (empty → mock mode) | From console.anthropic.com |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | `claude-sonnet-5-5` or `claude-haiku-5-5` are faster for a demo |
| `ANTHROPIC_EFFORT` | `low` | `low` is fastest; raise to `medium` if answers are shallow |
| `MOCK_AI` | unset | `1` forces mock mode even with a key (WiFi dies mid-demo → flip this, restart) |

## First 30 minutes (team checklist)

1. **One person clones, everyone else pulls** the same commit. `npm install` (if WiFi is bad, copy `node_modules` via AirDrop/USB from the laptop that installed it last night).
2. `cp .env.example .env.local`, paste the key, `npm run check`. Green line = live. If red, fix it now or decide to demo in mock mode.
3. `npm run dev`, open `/app`, submit the form once. Confirm streaming + "db: sqlite" badge. Everyone must see this working before touching code.
4. **Write the one-sentence idea** at the top of `PLAN.md` and the demo flow in 3 bullets. Nobody codes until this is written.
5. Rename the product: `layout.tsx` (nav), `page.tsx` (headline), `metadata.title`.
6. Decide the **input fields** of the form and the **shape of the output** (free text → use `streamText`; structured card → use `completeJSON` with a zod schema). Write the zod schema first.
7. Rewrite `src/lib/prompts.ts`: system prompt with the domain rules + 1 worked example; `buildPrompt()` from your fields. Test it in `/app` before touching UI.
8. If the demo needs seed data (a board, a catalog, a history), generate it **with Claude now** into `data/seed.json` and load it in `getStore()` on first run.
9. Split roles (see `PLAN.md`), create branches only if 3+ people; otherwise one branch, small commits, `git pull --rebase` often.
10. Set a phone alarm for **10:15 (idea locked), 13:00 (demo path works), 15:00 (pitch drafted), 15:30 (submit)**.

## Common moves

**Change the form → result flow.** Edit the two state fields in `generate-form.tsx`,
the zod `Body` in `api/generate/route.ts`, and `buildPrompt()` in `prompts.ts`. That's it.

**Return a structured object instead of text.**
```ts
// in a route handler
import { z } from "zod";
import { completeJSON } from "@/lib/ai";

const Result = z.object({ viable: z.boolean(), reason: z.string(), cost: z.number() });
const out = await completeJSON({
  prompt: buildPrompt(body),
  schema: Result,
  mock: { viable: true, reason: "Ejemplo en modo mock", cost: 1200000 },
});
return Response.json(out);
```

**Save something.**
```ts
const store = await getStore();
store.insert(newItem("order", { product: "yerba", qty: 2 }));
store.list("order", 10);
```

**Add a shadcn component.** `npx shadcn@latest add dialog` (needs WiFi; the 8 included cover most demos).

**Streaming looks stuck.** `status === "loading"` means waiting for the first byte;
with `claude-opus-5-5` that can be 2–5 s. Switch to `claude-sonnet-5-5` in `.env.local` for a snappier demo.

**WiFi dies during the pitch.** `MOCK_AI=1` in `.env.local`, restart dev server, same UI.
Better: before the pitch, run the real flow once and keep that tab open.

## Scripts

| Script | Does |
|--------|------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build (also typechecks) |
| `npm run start` | Serve the build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Ping the Anthropic API with the configured model |

## Notes

- Model calls use `output_config.effort` (no `budget_tokens`, no `temperature`), the current API shape for Claude 5-family models.
- `node:sqlite` is built into Node ≥ 22.13 / 24. Nothing to compile, no cloud. The DB file is `data/app.db` (git-ignored). On older Node the store silently falls back to memory and the badge says `db: memory`.
- The stream is plain `text/plain`; the client reads it with `fetch` + `ReadableStream`. No SSE parsing, no extra library.
