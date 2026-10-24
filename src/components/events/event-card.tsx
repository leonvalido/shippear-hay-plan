"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
        "flex gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-[background-color,transform] active:scale-[0.98]",
        onSelect && "cursor-pointer hover:bg-accent/60",
        selected && "border-primary ring-2 ring-primary/40",
        className,
      )}
    >
      <div
        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
        style={event.imageUrl ? { background: color } : { borderLeft: `4px solid ${color}` }}
      >
        {event.imageUrl ? (
          <>
            <CategoryIcon category={event.category} className="absolute size-7 text-white/80" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.imageUrl} alt="" className="relative h-full w-full object-cover" loading="lazy" />
          </>
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

/** Simple line icons per category; shown behind images while they load. */
function CategoryIcon({ category, className }: { category: Event["category"]; className?: string }) {
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
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[category]} />
    </svg>
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
      <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}
