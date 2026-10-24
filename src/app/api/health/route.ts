import { isMockMode, MODEL } from "@/lib/ai";
import { getEventStore } from "@/lib/events/store";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/health -> { ok, version, events, mode, backend, model } */
export async function GET() {
  try {
    const store = await getEventStore();
    return Response.json(
      {
        ok: true,
        version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 12),
        events: store.count(),
        mode: isMockMode() ? "mock" : "live",
        backend: store.backend,
        model: MODEL,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError("health", 500, "Store unavailable", err);
  }
}
