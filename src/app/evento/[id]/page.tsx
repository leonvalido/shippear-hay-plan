import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEvent } from "@/app/_lib/api";
import { CATEGORY_COLORS, CATEGORY_LABELS, displayTitle, formatPrice, formatTime, formatWhen, sourceLabel } from "@/components/events/format";
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
    title: event.title,
    description: `${formatWhen(event)} · ${event.venueName}`,
    openGraph: { title: event.title, images: event.imageUrl ? [event.imageUrl] : undefined },
  };
}

function directionsUrl(e: Event): string {
  const dest = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : `${e.address ?? e.venueName}, Rosario`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}

export default async function EventoPage({ params }: Props) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  const color = CATEGORY_COLORS[event.category];
  const hasCoords = event.lat != null && event.lng != null;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <Link href="/mapa" className="text-sm text-muted-foreground hover:underline">
← Ver en el mapa
      </Link>

      {event.imageUrl && (
        <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted sm:aspect-[2/1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <header className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge style={{ background: color, color: "#fff" }}>{CATEGORY_LABELS[event.category]}</Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {sourceLabel(event)}
          </Badge>
          {event.status === "pending" && <Badge variant="warning">pendiente de revisión</Badge>}
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{displayTitle(event)}</h1>
        {event.shortTitle && event.shortTitle.trim() !== event.title && <p className="text-base text-muted-foreground">{event.title}</p>}
        <p className="text-lg font-medium">
          {formatWhen(event)}
          {!event.timeUnknown && event.endsAt && <span className="text-muted-foreground"> – {formatTime(event.endsAt)}</span>}
        </p>
        <p className="text-muted-foreground">
          {event.venueName}
          {event.address && ` · ${event.address}`}
          {event.barrio && ` · ${event.barrio}`}
        </p>
        <p>
          <Badge variant={event.price?.free ? "success" : "secondary"} className="px-2.5 py-1 text-sm">
            {formatPrice(event.price)}
          </Badge>
        </p>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <a href={directionsUrl(event)} target="_blank" rel="noopener noreferrer">
            Cómo llegar
          </a>
        </Button>
        <ShareButton title={event.title} text={`${formatWhen(event)} · ${event.venueName}`} path={`/evento/${event.id}`} />
        {event.sourceUrl && (
          <Button asChild variant="ghost">
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
              Ver fuente
            </a>
          </Button>
        )}
      </div>

      {event.description && (
        <section className="mt-6">
          <h2 className="sr-only">Descripción</h2>
          <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
        </section>
      )}

      {hasCoords && (
        <section className="mt-6">
          <h2 className="sr-only">Ubicación</h2>
          <div className="h-56 overflow-hidden rounded-2xl border sm:h-72">
            <EventMap events={[event]} center={{ lat: event.lat!, lng: event.lng! }} zoom={15} interactive={false} />
          </div>
        </section>
      )}
    </article>
  );
}
