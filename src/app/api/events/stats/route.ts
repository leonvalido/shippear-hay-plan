import { NextRequest } from "next/server";
import { z } from "zod";
import { EventStatus } from "@/lib/events/schema";
import { getEventStore } from "@/lib/events/store";
import { cachedJson, jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/events/stats?from&to&status -> { total, byBarrio: [{barrio,count}], byCategory: [{category,count}] } */
const Query = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  status: EventStatus.default("published"),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError("events/stats", 400, parsed.error.issues[0]?.message ?? "Consulta inválida");
  try {
    const store = await getEventStore();
    return cachedJson(store.stats(parsed.data), parsed.data.status === "published");
  } catch (err) {
    return jsonError("events/stats", 500, "No se pudieron calcular las estadísticas", err);
  }
}
