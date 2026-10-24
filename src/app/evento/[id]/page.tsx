import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEvent, fetchEvents } from "@/app/_lib/api";
import { CategoryIcon } from "@/components/events/category-icon";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  displayTitle,
  formatPrice,
  formatTime,
  formatViews,
  formatWhen,
  formatWhenLong,
  hasPrice,
  haversineMeters,
  humanizeTitle,
  rosarioDayStart,
  sourceLabel,
  timeLabel,
} from "@/components/events/format";
import { ShareButton } from "@/components/events/share-button";
import { WalkingHint } from "@/components/events/walking-hint";
import { EventMap } from "@/components/map/event-map";
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

function directionsUrl(e: Event): string {
  const dest = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : `${e.address ?? e.venueName}, Rosario`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}

function primaryLabel(e: Event): string {
  if (e.sourceType === "ticketing") return "Entradas";
  if (e.sourceType === "tiktok") return "Ver en TikTok";
  if (e.sourceType === "instagram") return "Ver en Instagram";
  return "Ver fuente";
}

/** Category gradient for events without an image (brand mockup: light tone top-left to dark surface). */
function heroGradient(category: Event["category"]): string {
  const c = CATEGORY_COLORS[category];
  return `linear-gradient(160deg, color-mix(in oklch, ${c} 85%, white) 0%, ${c} 45%, oklch(0.22 0.05 280) 100%)`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Compact card for the horizontal strips (brand mockup "more"). */
function MiniCard({ e }: { e: Event }) {
  return (
    <Link href={`/evento/${e.id}`} className="surface tap block w-[200px] shrink-0 snap-start p-3">
      <span className="block text-[12px] font-semibold text-primary">{formatWhen(e)}</span>
      <span className="no-caps mt-1 line-clamp-2 block text-[14px] font-semibold leading-snug">{displayTitle(e)}</span>
      <span className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
        <CategoryIcon category={e.category} className="size-3 shrink-0" style={{ color: CATEGORY_COLORS[e.category] }} />
        {CATEGORY_LABELS[e.category]} · {humanizeTitle(e.venueName)}
      </span>
    </Link>
  );
}

export default async function EventoPage({ params }: Props) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  const hasCoords = event.lat != null && event.lng != null;
  const social = event.sourceType === "tiktok" || event.sourceType === "instagram";
  const color = CATEGORY_COLORS[event.category];
  const titleKey = norm(displayTitle(event));

  const dayStart = rosarioDayStart(0, new Date(event.startsAt));
  const dayEnd = rosarioDayStart(1, new Date(event.startsAt));
  const [atVenueRaw, sameDay] = await Promise.all([
    fetchEvents({ q: event.venueName.slice(0, 100), limit: "100", from: new Date().toISOString() }),
    fetchEvents({ from: dayStart.toISOString(), to: dayEnd.toISOString(), limit: "500" }),
  ]);
  const venueKey = norm(event.venueName);
  // Same venue, but not the same recurring event on another date.
  const atVenue = atVenueRaw.filter((e) => e.id !== event.id && norm(e.venueName) === venueKey && norm(displayTitle(e)) !== titleKey).slice(0, 6);
  const nearby = hasCoords
    ? sameDay
        .filter((e) => e.id !== event.id && norm(e.venueName) !== venueKey && e.lat != null && e.lng != null)
        .map((e) => ({ e, d: haversineMeters({ lat: event.lat!, lng: event.lng! }, { lat: e.lat!, lng: e.lng! }) }))
        .filter((x) => x.d <= 1000)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.e)
    : [];

  return (
    <article className="pb-28">
      {/* Editorial hero: full-bleed image or category gradient, title overlaid, back button on top. */}
      <header
        className="relative flex h-[360px] w-full flex-col justify-end overflow-hidden sm:h-[420px]"
        style={event.imageUrl ? undefined : { background: heroGradient(event.category) }}
      >
        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!event.imageUrl && (
          <CategoryIcon category={event.category} className="absolute right-7 top-24 size-32 text-white/90 sm:right-[calc(50%-320px)]" />
        )}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,transparent_35%,rgba(15,11,21,0.6)_70%,var(--background)_100%)]" />
        <div className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-[720px] items-center justify-between px-4 pt-4">
          <Link href="/mapa" aria-label="Volver al mapa" className="glass tap flex size-11 items-center justify-center rounded-full text-foreground">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[720px] px-5 pb-5">
          <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-white">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {formatWhen(event)}
            {!event.timeUnknown && event.endsAt && <span className="font-semibold text-white/70">– {formatTime(event.endsAt)}</span>}
          </p>
          <h1 className="no-caps text-[28px] font-extrabold leading-[1.15] tracking-[-0.01em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)] sm:text-[34px]">
            {displayTitle(event)}
          </h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[22px] px-5 pt-4">
        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-white" style={{ background: color }}>
            <CategoryIcon category={event.category} className="size-3.5" />
            {CATEGORY_LABELS[event.category]}
          </span>
          {social ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/8 px-2.5 text-[12px] font-semibold text-foreground">
              {event.sourceType === "tiktok" ? (
                <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
                  <path d="M16 2c.4 2.6 2 4.3 4.5 4.6V10c-1.7 0-3.2-.5-4.5-1.4V15a6 6 0 1 1-6-6v3.5a2.5 2.5 0 1 0 2.5 2.5V2z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              )}
              {event.sourceName}
              {event.metrics?.views ? ` · ${formatViews(event.metrics.views)} vistas` : ""}
            </span>
          ) : (
            event.sourceName && event.sourceName !== "sample" && (
              <span className="inline-flex h-7 items-center rounded-full bg-white/8 px-2.5 text-[12px] font-semibold text-muted-foreground">{humanizeTitle(sourceLabel(event))}</span>
            )
          )}
          {hasPrice(event.price) && (
            <span className={`inline-flex h-7 items-center rounded-full px-2.5 text-[12px] font-semibold ${event.price?.free ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-foreground"}`}>
              {formatPrice(event.price)}
            </span>
          )}
        </div>

        {event.description && <p className="whitespace-pre-line text-[15px] leading-[1.55] text-muted-foreground">{event.description}</p>}

        {/* Facts: only what we really know */}
        <dl className="flex flex-col">
          <Fact k="Cuándo">
            <b className="font-semibold">{formatWhenLong(event)}</b>
            {!event.timeUnknown && event.endsAt && <span className="text-muted-foreground"> – {formatTime(event.endsAt)}</span>}
            <a
              href={`/evento/${event.id}/calendar`}
              download={`hayplan-${event.id}.ics`}
              className="tap mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 text-[12px] font-semibold text-foreground"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
              </svg>
              Agregar al calendario
            </a>
          </Fact>
          <Fact k="Dónde">
            <b className="font-semibold">{humanizeTitle(event.venueName)}</b>
            {(event.address || event.barrio) && (
              <span className="block text-muted-foreground">
                {[event.address && humanizeTitle(event.address), event.barrio].filter(Boolean).join(", ")}
              </span>
            )}
            {hasCoords && <WalkingHint lat={event.lat} lng={event.lng} className="mt-1 inline-block rounded-lg bg-accent px-2 py-0.5 text-[12px] font-semibold text-accent-foreground" />}
          </Fact>
          {event.sourceName && event.sourceName !== "sample" && (
            <Fact k="Fuente">
              <b className="font-semibold">
                {social ? `${event.sourceType === "tiktok" ? "TikTok" : "Instagram"} · ${event.sourceName}` : humanizeTitle(sourceLabel(event))}
              </b>
            </Fact>
          )}
          {hasPrice(event.price) && (
            <Fact k="Entrada">
              <b className="font-semibold">{formatPrice(event.price)}</b>
              {event.price && !event.price.free && event.price.min != null && event.price.max != null && event.price.max !== event.price.min && (
                <span className="text-muted-foreground"> · según sector</span>
              )}
            </Fact>
          )}
          {event.timeUnknown && (
            <Fact k="Horario">
              <b className="font-semibold">{timeLabel(event)}</b>
            </Fact>
          )}
        </dl>

        {/* Map */}
        {hasCoords && (
          <div className="relative h-[180px] overflow-hidden rounded-[18px] border border-white/8 bg-[#141020]">
            <EventMap events={[event]} center={{ lat: event.lat!, lng: event.lng! }} zoom={15} interactive={false} />
            <div className="glass absolute bottom-3 left-3 rounded-xl px-3 py-2 text-[12px] font-semibold leading-tight">
              {humanizeTitle(event.venueName)}
              {event.barrio && <small className="block font-normal text-muted-foreground">{event.barrio}</small>}
            </div>
          </div>
        )}

        {atVenue.length > 0 && (
          <section>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Más en este lugar</h2>
            <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {atVenue.map((e) => (
                <MiniCard key={e.id} e={e} />
              ))}
            </div>
          </section>
        )}

        {nearby.length > 0 && (
          <section>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Cerca y a la misma hora</h2>
            <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {nearby.map((e) => (
                <MiniCard key={e.id} e={e} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-white/8 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-2.5 px-4">
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tap flex h-12 flex-1 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-bold text-white"
            >
              {primaryLabel(event)}
            </a>
          )}
          <a
            href={directionsUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className={`tap flex h-12 flex-1 items-center justify-center rounded-full px-5 text-[15px] font-bold ${event.sourceUrl ? "border border-white/8 bg-white/8 text-foreground" : "bg-primary text-white"}`}
          >
            Cómo llegar
          </a>
          <ShareButton iconOnly title={displayTitle(event)} text={`${formatWhen(event)} · ${event.venueName}`} path={`/evento/${event.id}`} className="tap size-11 shrink-0 rounded-full border-white/8 bg-white/8" />
        </div>
      </div>
    </article>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-white/8 py-3 text-[14px] leading-[1.4] first:border-t-0">
      <dt className="w-[88px] shrink-0 pt-px text-[13px] text-muted-foreground">{k}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
