import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEvent, fetchEvents } from "@/app/_lib/api";
import { EventCard } from "@/components/events/event-card";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  displayTitle,
  formatViews,
  formatPrice,
  formatTime,
  formatWhen,
  haversineMeters,
  humanizeTitle,
  rosarioDayStart,
  sourceLabel,
} from "@/components/events/format";
import { CategoryIcon } from "@/components/events/category-icon";
import { ShareButton } from "@/components/events/share-button";
import { WalkingHint } from "@/components/events/walking-hint";
import { EventMap } from "@/components/map/event-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Event } from "@/lib/events/schema";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) return { title: "Evento" };
  return {
    title: displayTitle(event),
    description: `${formatWhen(event)} · ${event.venueName}`,
    alternates: { canonical: `/evento/${event.id}` },
    openGraph: { type: "article", title: displayTitle(event), description: `${formatWhen(event)} · ${event.venueName}` },
  };
}

/** Titles sometimes come in ALL CAPS: title-case them as a fallback. */
function tidyTitle(t: string): string {
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s(¡¿"-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

function directionsUrl(e: Event): string {
  const dest = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : `${e.address ?? e.venueName}, Rosario`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}

function primaryLabel(e: Event): string {
  if (e.sourceType === "ticketing") return "Comprar entradas";
  if (e.sourceType === "tiktok") return "Ver en TikTok";
  if (e.sourceType === "instagram") return "Ver en Instagram";
  return "Ver fuente oficial";
}

/** An .ics file as a data URL: opens the calendar on phones, downloads on desktop. */
function calendarHref(e: Event, url: string): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HayPlan//ES",
    "BEGIN:VEVENT",
    `UID:${e.id}@hayplan`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(start.toISOString())}`,
    `DTEND:${stamp(end.toISOString())}`,
    `SUMMARY:${esc(displayTitle(e))}`,
    `LOCATION:${esc([humanizeTitle(e.venueName), e.address && humanizeTitle(e.address), "Rosario"].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc((e.description ?? "").slice(0, 500))}\\n${esc(url)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

function durationLabel(e: Event): string | null {
  if (!e.endsAt || e.timeUnknown) return null;
  const mins = Math.round((new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function audienceLabel(desc?: string): string | null {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (/\batp\b|todo p[úu]blico|apto para todo/.test(d)) return "Para todo público";
  if (/\+\s?18|mayores de 18|solo mayores/.test(d)) return "Solo mayores de 18";
  const m = d.match(/mayores de (\d{1,2})/);
  if (m) return `Mayores de ${m[1]}`;
  if (/ni[ñn]os|ni[ñn]as|infantil|familia|chicos/.test(d)) return "Para ir con chicos";
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export default async function EventoPage({ params }: Props) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  const hasCoords = event.lat != null && event.lng != null;
  const showFull = !!event.shortTitle && event.shortTitle.trim() !== event.title;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://shippear-starter.vercel.app");
  const url = `${site}/evento/${event.id}`;

  // Related: same venue, and nearby on the same day.
  const dayStart = rosarioDayStart(0, new Date(event.startsAt));
  const dayEnd = rosarioDayStart(1, new Date(event.startsAt));
  const [atVenueRaw, sameDay] = await Promise.all([
    fetchEvents({ q: event.venueName.slice(0, 100), limit: "100", from: new Date().toISOString() }),
    fetchEvents({ from: dayStart.toISOString(), to: dayEnd.toISOString(), limit: "500" }),
  ]);
  const venueKey = norm(event.venueName);
  const atVenue = atVenueRaw.filter((e) => e.id !== event.id && norm(e.venueName) === venueKey).slice(0, 6);
  const nearby = hasCoords
    ? sameDay
        .filter((e) => e.id !== event.id && norm(e.venueName) !== venueKey && e.lat != null && e.lng != null)
        .map((e) => ({ e, d: haversineMeters({ lat: event.lat!, lng: event.lng! }, { lat: e.lat!, lng: e.lng! }) }))
        .filter((x) => x.d <= 1000)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.e)
    : [];

  const facts: { k: string; v: string }[] = [
    { k: "Categoría", v: CATEGORY_LABELS[event.category] },
    ...(durationLabel(event) ? [{ k: "Duración", v: durationLabel(event)! }] : []),
    ...(audienceLabel(event.description) ? [{ k: "Público", v: audienceLabel(event.description)! }] : []),
    ...(event.sourceName && event.sourceName !== "sample" ? [{ k: "Organiza / fuente", v: humanizeTitle(sourceLabel(event)) }] : []),
    { k: "Entrada", v: formatPrice(event.price) + (event.price && !event.price.free && event.price.max && event.price.max !== event.price.min ? " (según sector)" : "") },
  ];

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <Link href="/mapa" className="tap inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        ← Ver en el mapa
      </Link>

      {event.imageUrl && (
        <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted sm:aspect-[2/1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* Hero */}
      <header className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <CategoryIcon category={event.category} className="size-3.5" style={{ color: CATEGORY_COLORS[event.category] }} />
            {CATEGORY_LABELS[event.category]}
          </Badge>
          {(event.sourceType === "tiktok" || event.sourceType === "instagram") && (
            <Badge variant="outline" className="gap-1">
              Visto en {event.sourceType === "tiktok" ? "TikTok" : "Instagram"}
              {event.sourceName && <span className="text-tertiary">· {event.sourceName}</span>}
              {event.metrics?.views ? <span className="font-semibold text-foreground">· {formatViews(event.metrics.views)} vistas</span> : null}
            </Badge>
          )}
          {event.status === "pending" && <Badge variant="warning">pendiente de revisión</Badge>}
        </div>
        <h1 className="line-clamp-3 break-words font-display text-3xl font-semibold leading-tight">{tidyTitle(displayTitle(event))}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-medium">
          <span>
            {formatWhen(event)}
            {!event.timeUnknown && event.endsAt && <span className="text-muted-foreground"> – {formatTime(event.endsAt)}</span>}
          </span>
          <a
            href={calendarHref(event, url)}
            download={`hayplan-${event.id}.ics`}
            className="tap inline-flex h-8 items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 text-[13px] font-medium text-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
            </svg>
            Agregar al calendario
          </a>
        </p>
        <p className="break-words text-base text-muted-foreground">
          {humanizeTitle(event.venueName)}
          {event.address && ` · ${humanizeTitle(event.address)}`}
          {event.barrio && ` · ${event.barrio}`}
          <WalkingHint lat={event.lat} lng={event.lng} />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={event.price?.free ? "success" : "secondary"} className="h-7 px-3 text-[13px]">
            {formatPrice(event.price)}
          </Badge>
          {event.price && !event.price.free && event.price.min != null && event.price.max != null && event.price.max !== event.price.min && (
            <span className="text-[13px] text-tertiary">según sector</span>
          )}
        </div>
      </header>

      {/* Actions */}
      <div className="mt-6 flex gap-2">
        {event.sourceUrl && (
          <Button asChild className="tap h-12 min-w-0 flex-1 rounded-full px-3 text-base font-semibold">
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
              {primaryLabel(event)}
            </a>
          </Button>
        )}
        <Button asChild variant={event.sourceUrl ? "outline" : "default"} className="tap h-12 min-w-0 flex-1 rounded-full px-3 text-base font-semibold">
          <a href={directionsUrl(event)} target="_blank" rel="noopener noreferrer">
            Cómo llegar
          </a>
        </Button>
        <ShareButton iconOnly title={displayTitle(event)} text={`${formatWhen(event)} · ${event.venueName}`} path={`/evento/${event.id}`} className="tap size-12 shrink-0 rounded-full" />
      </div>
      {event.links && event.links.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Más links">
          {event.links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tap inline-flex h-8 items-center rounded-full border border-white/8 bg-white/5 px-3 text-[13px] font-medium text-foreground hover:bg-white/10"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* AI description */}
      {event.description && (
        <section className="mt-8">
          <h2 className="sr-only">Descripción</h2>
          <p className="whitespace-pre-line text-base leading-[1.45]">{event.description}</p>
        </section>
      )}

      {/* Facts */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Lo que tenés que saber</h2>
        <dl className="mt-3 divide-y divide-white/8 rounded-xl border border-white/8">
          {facts.map((f) => (
            <div key={f.k} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-[13px] text-muted-foreground">{f.k}</dt>
              <dd className="text-right text-[15px] font-medium">{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Map */}
      {hasCoords && (
        <section className="mt-8">
          <h2 className="sr-only">Ubicación</h2>
          <div className="h-40 overflow-hidden rounded-xl border border-white/8">
            <EventMap events={[event]} center={{ lat: event.lat!, lng: event.lng! }} zoom={15} interactive={false} />
          </div>
        </section>
      )}

      {/* Same venue */}
      {atVenue.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Más en este lugar</h2>
          <div className="mt-3 space-y-3">
            {atVenue.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Nearby, same day */}
      {nearby.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Cerca y a la misma hora</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">A menos de un kilómetro, el mismo día.</p>
          <div className="mt-3 space-y-3">
            {nearby.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>
      )}

      {showFull && (
        <p className="mt-10 text-xs text-tertiary">
          Nombre original: <span className="no-caps">{tidyTitle(event.title)}</span>
        </p>
      )}
    </article>
  );
}
