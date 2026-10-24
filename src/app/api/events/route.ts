import { NextRequest } from "next/server";
import { EventsQuerySchema } from "@/lib/events/schema";
import { sampleEvents } from "@/lib/events/sample";

export const runtime = "nodejs";

/** STUB (contract only). Backend session replaces with the SQLite-backed implementation. */
export async function GET(req: NextRequest) {
  const parsed = EventsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const q = parsed.data;
  let events = sampleEvents().filter((e) => e.status === q.status);
  if (q.category) events = events.filter((e) => e.category === q.category);
  if (q.from) events = events.filter((e) => e.startsAt >= q.from!);
  if (q.to) events = events.filter((e) => e.startsAt <= q.to!);
  if (q.q) events = events.filter((e) => `${e.title} ${e.venueName}`.toLowerCase().includes(q.q!.toLowerCase()));
  return Response.json({ events: events.slice(0, q.limit) });
}

export async function POST() {
  return Response.json({ error: "Not implemented yet (backend session)" }, { status: 501 });
}
