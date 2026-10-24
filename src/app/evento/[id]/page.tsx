import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEvent } from "@/app/_lib/api";
import { CATEGORY_LABELS, displayTitle, humanizeTitle, formatPrice, formatTime, formatWhen, sourceLabel } from "@/components/events/format";
import { ShareButton } from "@/components/events/share-button";
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

export default async function EventoPage({ params }: Props) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  const hasCoords = event.lat != null && event.lng != null;
  const showFull = !!event.shortTitle && event.shortTitle.trim() !== event.title;

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

      <header className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{CATEGORY_LABELS[event.category]}</Badge>
          {event.status === "pending" ? (
            <Badge variant="warning">pendiente de revisión</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              {sourceLabel(event)}
            </Badge>
          )}
        </div>
        <h1 className="line-clamp-3 break-words font-display text-3xl font-semibold leading-tight">{tidyTitle(displayTitle(event))}</h1>
        <p className="text-lg font-medium">
          {formatWhen(event)}
          {!event.timeUnknown && event.endsAt && <span className="text-muted-foreground"> – {formatTime(event.endsAt)}</span>}
        </p>
        <p className="break-words text-base text-muted-foreground">
          {humanizeTitle(event.venueName)}
          {event.address && ` · ${humanizeTitle(event.address)}`}
          {event.barrio && ` · ${event.barrio}`}
        </p>
        <div>
          <Badge variant={event.price?.free ? "success" : "secondary"}>{formatPrice(event.price)}</Badge>
        </div>
      </header>

      <div className="mt-6 flex gap-3">
        <Button asChild className="tap h-11 min-w-0 flex-1 rounded-full px-3 text-base">
          <a href={directionsUrl(event)} target="_blank" rel="noopener noreferrer">
            Cómo llegar
          </a>
        </Button>
        <ShareButton
          title={displayTitle(event)}
          text={`${formatWhen(event)} · ${event.venueName}`}
          path={`/evento/${event.id}`}
          className="tap h-11 min-w-0 flex-1 rounded-full px-3 text-base"
        />
      </div>
      {event.sourceUrl && (
        <p className="mt-1 text-center sm:text-left">
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver fuente
          </a>
        </p>
      )}

      {event.description && (
        <section className="mt-6">
          <h2 className="sr-only">Descripción</h2>
          <p className="whitespace-pre-line text-base leading-[1.45]">{event.description}</p>
        </section>
      )}

      {hasCoords && (
        <section className="mt-6">
          <h2 className="sr-only">Ubicación</h2>
          <div className="h-40 overflow-hidden rounded-xl border border-white/8">
            <EventMap events={[event]} center={{ lat: event.lat!, lng: event.lng! }} zoom={15} interactive={false} />
          </div>
        </section>
      )}
      {showFull && (
        <p className="mt-8 text-xs text-tertiary">
          Nombre original: <span className="no-caps">{tidyTitle(event.title)}</span>
        </p>
      )}
    </article>
  );
}
