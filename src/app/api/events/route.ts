import { NextRequest } from "next/server";
import { EventsQuerySchema, RawEventSchema } from "@/lib/events/schema";
import { getEventStore, toCard, toEvent } from "@/lib/events/store";
import { fingerprint, shortHash } from "@/lib/events/normalize";
import { cachedJson, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/events?from&to&category&q&bbox&status&limit -> { events: EventCard[] }
 * Card shape only (no description/sourceUrl: those live on /api/events/:id).
 * Published lists are CDN-cached for 5 minutes; pending/rejected are not.
 */
export async function GET(req: NextRequest) {
  const parsed = EventsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError("events", 400, parsed.error.issues[0]?.message ?? "Consulta inválida");
  try {
    const store = await getEventStore();
    const events = store.queryEvents(parsed.data).map(toCard);
    return cachedJson({ events }, parsed.data.status === "published");
  } catch (err) {
    return jsonError("events", 500, "No se pudieron leer los eventos", err);
  }
}

/** POST /api/events  body RawEvent -> 201 { event } with status "pending" */
export async function POST(req: NextRequest) {
  const parsed = RawEventSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError("events", 400, `Evento inválido: ${issue?.path.join(".") || "body"} ${issue?.message ?? ""}`.trim());
  }
  try {
    const store = await getEventStore();
    const raw = parsed.data;
    const id = `${raw.sourceType}-${shortHash(`${fingerprint(raw)}|${Date.now()}|${Math.random()}`)}`;
    const event = toEvent(raw, id, "pending");
    store.upsertEvent(event);
    return Response.json({ event }, { status: 201 });
  } catch (err) {
    return jsonError("events", 500, "No se pudo guardar el evento", err);
  }
}
