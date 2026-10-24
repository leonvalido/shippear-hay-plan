"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { CATEGORY_COLORS, CATEGORY_LABELS, displayTitle, distanceLabel, formatPrice, formatTime, formatWhen, hasPrice, humanizeTitle, type LatLng } from "./format";

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

/** Category gradient for cards without an image (brand list mockup, option 3). */
export function categoryGradient(category: Event["category"]): string {
  const c = CATEGORY_COLORS[category];
  return `linear-gradient(150deg, color-mix(in oklch, ${c} 88%, white) 0%, ${c} 40%, color-mix(in oklch, ${c} 55%, black) 100%)`;
}

/**
 * Editorial card (list option 3): 16:9 image or category gradient, title overlaid at the bottom,
 * GRATIS tag on the image, then "HH:MM · venue" and the category under it. The whole card is the link.
 */
export function EventCardEditorial({ event, selected, onSelect, index = 0, showTime = true, className }: Props & { showTime?: boolean }) {
  const color = CATEGORY_COLORS[event.category];
  const [broken, setBroken] = useState(false);
  const free = !!event.price?.free;
  const paid = hasPrice(event.price) && !free;
  return (
    <Link
      href={`/evento/${event.id}`}
      data-event-id={event.id}
      onPointerEnter={() => onSelect?.(event.id)}
      onFocus={() => onSelect?.(event.id)}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className={cn("tap row-in block", className)}
    >
      <div
        className={cn("relative flex aspect-[3/1] items-end overflow-hidden rounded-[14px] p-2.5", selected && "ring-2 ring-primary/60")}
        style={{ background: categoryGradient(event.category) }}
      >
        {event.imageUrl && !broken ? (
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 352px, 100vw"
            quality={85}
            loading="lazy"
            className="object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <CategoryIcon category={event.category} className="absolute right-3 top-2.5 size-9 text-white/35" />
        )}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(10,7,14,0.85)_100%)]" />
        {free && (
          <span className="absolute left-2.5 top-2.5 z-[1] rounded-[6px] bg-[rgba(10,7,14,0.6)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-emerald-300 backdrop-blur-sm">
            Gratis
          </span>
        )}
        <h3 className="no-caps relative z-[1] line-clamp-2 text-[15px] font-semibold leading-[1.25] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
          {displayTitle(event)}
        </h3>
      </div>
      <div className="flex items-center justify-between gap-3 px-0.5 pt-1.5 text-[12px] font-semibold">
        <span className="min-w-0 truncate">
          {showTime && <span>{event.timeUnknown ? "Horario a confirmar" : formatTime(event.startsAt)}</span>}
          <span className="font-normal text-muted-foreground">
            {showTime ? " · " : ""}
            {humanizeTitle(event.venueName)}
          </span>
          {paid && <span className="text-muted-foreground"> · {formatPrice(event.price)}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <CategoryIcon category={event.category} className="size-3" style={{ color }} />
          {CATEGORY_LABELS[event.category]}
        </span>
      </div>
    </Link>
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
