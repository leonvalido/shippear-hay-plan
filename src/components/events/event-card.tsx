"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS, SOCIAL_SOURCES, displayTitle, formatPrice, formatViews, formatWhen, humanizeTitle, walkMinutes, type LatLng } from "./format";

type Props = {
  event: Event;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Kept for API compatibility; the when-line always shows day · time. */
  showDate?: boolean;
  /** The viewer's position; when given, the card shows walking minutes. */
  from?: LatLng | null;
  /** Stagger index for the list render animation. */
  index?: number;
  className?: string;
};

/**
 * Event row: 64px thumbnail (category fallback), then
 * line 1 day · time (small, muted) · line 2 title (15px semibold, 2 lines) · line 3 venue (muted) · two pills max.
 */
export function EventCard({ event, selected, onSelect, from, index = 0, className }: Props) {
  const color = CATEGORY_COLORS[event.category];
  const mins = walkMinutes(from, event);
  const social = SOCIAL_SOURCES.has(event.sourceType);
  return (
    <article
      data-event-id={event.id}
      onClick={() => onSelect?.(event.id)}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className={cn(
        "surface tap row-in flex gap-3 p-3",
        onSelect && "cursor-pointer",
        selected && "border-primary/70 ring-2 ring-primary/30",
        className,
      )}
    >
      <Thumb event={event} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">{formatWhen(event)}</p>
        <h3 className="no-caps line-clamp-2 text-[15px] font-semibold leading-snug">
          <Link href={`/evento/${event.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {displayTitle(event)}
          </Link>
        </h3>
        <p className="truncate text-[13px] text-muted-foreground">
          {humanizeTitle(event.venueName)}
          {mins != null && <span className="text-tertiary"> · a {mins >= 90 ? `${Math.round(mins / 60)} h` : `${mins} min`} caminando</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Badge variant={event.price?.free ? "success" : "secondary"}>{formatPrice(event.price)}</Badge>
          {social ? (
            <SocialBadge event={event} />
          ) : (
            <Badge variant="outline" className="gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />
              {CATEGORY_LABELS[event.category]}
            </Badge>
          )}
          {selected && (
            <Link
              href={`/evento/${event.id}`}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white"
            >
              Ver evento <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** 64px thumbnail: the image when there is one, else a category-tinted tile with a line icon. */
function Thumb({ event }: { event: Event }) {
  const color = CATEGORY_COLORS[event.category];
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
      style={{ background: `color-mix(in oklch, ${color} 28%, var(--card))` }}
    >
      <CategoryIcon category={event.category} className="absolute size-7" style={{ color }} />
      {event.imageUrl && !broken && (
        <Image
          src={event.imageUrl}
          alt=""
          width={64}
          height={64}
          sizes="64px"
          loading="lazy"
          className="relative h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

/** Simple line icons per category. */
export function CategoryIcon({ category, className, style }: { category: Event["category"]; className?: string; style?: React.CSSProperties }) {
  const paths: Record<Event["category"], string> = {
    musica: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    teatro: "M4 4h16v6a8 8 0 0 1-16 0zM8 8h.01M16 8h.01M9 13a4 4 0 0 0 6 0",
    fiesta: "M5 21l5-14 9 9zM14 4l1 2M18 2l-1 3M20 8l-3 1",
    feria: "M3 9l2-5h14l2 5M3 9v11h18V9M3 9h18M9 20v-6h6v6",
    deporte: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20",
    cultura: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h14",
    gastronomia: "M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 2a4 4 0 0 0-4 4v6h4v10",
    infantil: "M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z",
    charla: "M4 4h16v11H8l-4 4z",
    otro: "M12 3v18M3 12h18",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[category]} />
    </svg>
  );
}

/** "Visto en TikTok · @handle · 12,3 mil vistas" */
function SocialBadge({ event }: { event: Event }) {
  const tiktok = event.sourceType === "tiktok";
  const views = event.metrics?.views;
  return (
    <Badge variant="outline" className="gap-1">
      Visto en {tiktok ? "TikTok" : "Instagram"}
      {event.sourceName && <span className="text-tertiary">· {event.sourceName}</span>}
      {views != null && <span className="font-semibold text-foreground">· {formatViews(views)}</span>}
    </Badge>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="surface flex gap-3 p-3" aria-hidden>
      <Skeleton className="size-16 shrink-0 rounded-[10px]" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-2/5 rounded-full" />
      </div>
    </div>
  );
}
