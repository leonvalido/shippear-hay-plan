"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { CATEGORY_COLORS, CATEGORY_LABELS, displayTitle, distanceLabel, formatPrice, formatWhen, hasPrice, humanizeTitle, type LatLng } from "./format";

type Props = {
  event: Event;
  selected?: boolean;
  /** Hover/focus highlight (pin on the map); tapping the card always opens the event. */
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
 * Event row, the whole card is the link: 64px thumbnail (category fallback), then
 * line 1 day · time (small, muted) · line 2 title (15px semibold, 2 lines) · line 3 venue (muted) · price + category.
 */
export function EventCard({ event, selected, onSelect, from, index = 0, className }: Props) {
  const color = CATEGORY_COLORS[event.category];
  const dist = distanceLabel(from, event);
  return (
    <Link
      href={`/evento/${event.id}`}
      data-event-id={event.id}
      onPointerEnter={() => onSelect?.(event.id)}
      onFocus={() => onSelect?.(event.id)}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className={cn(
        "surface tap row-in flex gap-3 p-3 text-left active:bg-white/5",
        selected && "border-primary/70 ring-2 ring-primary/30",
        className,
      )}
    >
      <Thumb event={event} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">{formatWhen(event)}</p>
        <h3 className="no-caps line-clamp-2 text-[15px] font-semibold leading-snug">{displayTitle(event)}</h3>
        <p className="truncate text-[13px] text-muted-foreground">
          {humanizeTitle(event.venueName)}
          {dist && <span className="text-tertiary"> · {dist}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {hasPrice(event.price) && <Badge variant={event.price?.free ? "success" : "secondary"}>{formatPrice(event.price)}</Badge>}
          <Badge variant="outline" className="gap-1.5">
            <CategoryIcon category={event.category} className="size-3.5" style={{ color }} />
            {CATEGORY_LABELS[event.category]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

/** 64px thumbnail: the image when there is one (requested at 2x), else a category-tinted tile with the icon. */
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
          width={128}
          height={128}
          quality={85}
          loading="lazy"
          className="relative h-full w-full object-cover"
          onError={() => setBroken(true)}
          onLoad={(e) => {
            // The optimizer never upscales: a tiny source comes back tiny. Show the category tile instead of a blur.
            const img = e.currentTarget;
            if (Math.min(img.naturalWidth, img.naturalHeight) < 120) setBroken(true);
          }}
        />
      )}
    </div>
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
