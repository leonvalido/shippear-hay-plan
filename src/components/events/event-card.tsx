"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_LABELS, SOCIAL_SOURCES, formatDate, formatDayShort, formatMonthShort, formatPrice, formatTime, formatViews, sourceLabel, walkMinutes, type LatLng } from "./format";

type Props = {
  event: Event;
  selected?: boolean;
  onSelect?: (id: string) => void;
  showDate?: boolean;
  /** The viewer's position; when given, the card shows walking minutes. */
  from?: LatLng | null;
  className?: string;
};

/** Compact event row used in the map list, duplicates list and detail pages. */
export function EventCard({ event, selected, onSelect, showDate = true, from, className }: Props) {
  const color = CATEGORY_COLORS[event.category];
  const mins = walkMinutes(from, event);
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
          {showDate || event.imageUrl ? `${formatTime(event.startsAt)} · ` : ""}
          {event.venueName}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {selected && (
            <Link
              href={`/evento/${event.id}`}
              className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver evento →
            </Link>
          )}
          <Badge variant={event.price?.free ? "success" : "secondary"}>{formatPrice(event.price)}</Badge>
          {mins != null && (
            <Badge variant="outline" className="gap-1">
              a {mins >= 90 ? `${Math.round(mins / 60)} h` : `${mins} min`} caminando
            </Badge>
          )}
          <Badge style={{ background: color, color: "#fff" }}>{CATEGORY_LABELS[event.category]}</Badge>
          {SOCIAL_SOURCES.has(event.sourceType) ? (
            <SocialBadge event={event} />
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              {sourceLabel(event)}
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
}

/** "Visto en TikTok · @handle · 12,3 mil" */
function SocialBadge({ event }: { event: Event }) {
  const tiktok = event.sourceType === "tiktok";
  const views = event.metrics?.views;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", tiktok ? "border-white/20 bg-black text-white" : "border-pink-400/40 bg-pink-500/15 text-pink-300")}
    >
      Visto en {tiktok ? "TikTok" : "Instagram"}
      {event.sourceName && <span className="opacity-80">· {event.sourceName}</span>}
      {views != null && <span className="font-semibold">· {formatViews(views)} vistas</span>}
    </Badge>
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
