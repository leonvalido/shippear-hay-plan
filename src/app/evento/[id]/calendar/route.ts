import { apiBase, fetchEvent } from "@/app/_lib/api";
import { displayTitle, humanizeTitle } from "@/components/events/format";
import type { Event } from "@/lib/events/schema";

export const runtime = "nodejs";

function buildIcs(e: Event, url: string): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HayPlan//ES",
    "BEGIN:VEVENT",
    `UID:${e.id}@hayplan`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(displayTitle(e))}`,
    `LOCATION:${esc([humanizeTitle(e.venueName), e.address && humanizeTitle(e.address), "Rosario"].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc((e.description ?? "").slice(0, 500))}\\n${esc(url)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = await fetchEvent(id);
  if (!event) return new Response("Not found", { status: 404 });
  const url = `${await apiBase()}/evento/${id}`;
  return new Response(buildIcs(event, url), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="hayplan-${id}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
