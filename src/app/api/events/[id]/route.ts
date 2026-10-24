import { NextRequest } from "next/server";
import { getEventStore } from "@/lib/events/store";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/events/:id -> { event } | 404 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || id.length > 120) return jsonError("events/id", 400, "Id inválido");
  try {
    const event = (await getEventStore()).getEvent(id);
    if (!event) return Response.json({ error: "No existe" }, { status: 404 });
    return Response.json({ event });
  } catch (err) {
    return jsonError("events/id", 500, "No se pudo leer el evento", err);
  }
}
