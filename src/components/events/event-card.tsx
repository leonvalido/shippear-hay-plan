"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS, formatDate, formatDayShort, formatMonthShort, formatPrice, formatTime, sourceLabel } from "./format";

type Props = {
  event: Event;
  selected?: boolean;
  onSelect?: (id: string) => void;
  showDate?: boolean;
  className?: string;
};

/** Compact event row used in the map list, duplicates list and detail pages. */
export function EventCard({ event, selected, onSelect, showDate = true, className }: Props) {
  const color = CATEGORY_COLORS[event.category];
  return (
    <article
      data-event-id={event.id}
      onClick={() => onSelect?.(event.id)}
      className={cn(
        "flex gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-colors",
        onSelect && "cursor-pointer hover:bg-accent/60",
        selected && "border-primary ring-2 ring-primary/40",
        className,
      )}
    >
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="text-center text-[11px] leading-tight">
            {showDate && <div className="font-semibold">{formatDayShort(event.startsAt)}</div>}
            {showDate && <div className="text-muted-foreground">{formatMonthShort(event.startsAt)}</div>}
            <div className={showDate ? "" : "text-sm font-semibold"}>{formatTime(event.startsAt)}</div>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
          <Link href={`/evento/${event.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {event.title}
          </Link>
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {showDate && event.imageUrl ? `${formatDate(event.startsAt)}, ` : ""}
          {formatTime(event.startsAt)} · {event.venueName}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={event.price?.free ? "success" : "secondary"}>{formatPrice(event.price)}</Badge>
          <Badge variant="outline" style={{ borderColor: color, color }}>
            {CATEGORY_LABELS[event.category]}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {sourceLabel(event)}
          </Badge>
        </div>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-xl border p-3" aria-hidden>
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-accent" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-accent" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-accent" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-accent" />
      </div>
    </div>
  );
}
