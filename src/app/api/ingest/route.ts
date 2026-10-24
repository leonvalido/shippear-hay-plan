import { NextRequest } from "next/server";
import { z } from "zod";
import { RawEventSchema } from "@/lib/events/schema";
import { getEventStore, upsertRaw } from "@/lib/events/store";
import { eventId } from "@/lib/events/normalize";
import { jsonError, readJson, safeEqual } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/ingest  header x-ingest-key = INGEST_KEY, body { events: RawEvent[] }
 * -> { inserted, merged, skipped }. Events land as "published".
 */
const Body = z.object({ events: z.array(z.unknown()).max(500) });

export async function POST(req: NextRequest) {
  const key = process.env.INGEST_KEY;
  if (!key) return jsonError("ingest", 503, "Ingesta deshabilitada: falta INGEST_KEY en el servidor");
  if (!safeEqual(req.headers.get("x-ingest-key") ?? "", key)) return jsonError("ingest", 401, "x-ingest-key inválida");

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("ingest", 400, "Body inválido: se espera { events: RawEvent[] } (máx. 500)");

  try {
    const store = await getEventStore();
    const result = { inserted: 0, merged: 0, skipped: 0 };
    for (const item of parsed.data.events) {
      const raw = RawEventSchema.safeParse(item);
      if (!raw.success) { result.skipped++; continue; }
      result[upsertRaw(store, raw.data, eventId(raw.data), "published")]++;
    }
    return Response.json(result);
  } catch (err) {
    return jsonError("ingest", 500, "Falló la ingesta", err);
  }
}
