import { NextRequest } from "next/server";
import { sampleEvents } from "@/lib/events/sample";

export const runtime = "nodejs";

/** STUB (contract only). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = sampleEvents().find((e) => e.id === id);
  if (!event) return Response.json({ error: "No existe" }, { status: 404 });
  return Response.json({ event });
}
