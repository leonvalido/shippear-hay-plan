"use client";

import Link from "next/link";
import { CategoryIcon } from "@/components/events/category-icon";
import { CATEGORY_COLORS } from "@/components/events/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { StreamStatus } from "@/hooks/use-stream";
import type { EventCategory } from "@/lib/events/schema";
import { cn } from "@/lib/utils";
import type { ParsedPlan, PlanStop } from "./plan-stream";
import { WhatsAppButton } from "./whatsapp-button";
import { planToText } from "./plan-stream";

type Props = {
  plan: ParsedPlan;
  status: StreamStatus;
  /** Resolve a stop to an event id / category when the API omits them (match by title). */
  resolve?: (stop: PlanStop) => { id?: string; category?: EventCategory } | undefined;
  onPick?: (stop: PlanStop) => void;
  className?: string;
};

/** Structured plan: intro, numbered stops on a thin timeline (progressive), outro, WhatsApp. */
export function PlanView({ plan, status, resolve, onPick, className }: Props) {
  const streaming = status === "loading" || status === "streaming";
  const pending = streaming ? Math.max(0, (plan.stops.length === 0 ? 2 : 3) - plan.stops.length) : 0;
  const text = plan.shareText ?? planToText(plan);
  return (
    <div className={cn("space-y-4", className)}>
      {plan.intro ? <p className="text-[15px] leading-[1.45] text-muted-foreground">{plan.intro}</p> : streaming && <Skeleton className="h-4 w-3/4" />}

      <ol className="relative space-y-3 pl-7" aria-label="Paradas del plan">
        <span aria-hidden className="absolute bottom-5 left-[11px] top-5 w-px bg-white/10" />
        {plan.stops.map((s, i) => {
          const r = resolve?.(s);
          const category = s.category ?? r?.category;
          const id = s.eventId ?? r?.id;
          const inner = (
            <>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[15px] font-bold tabular-nums">{s.time}</span>
                <span className="no-caps line-clamp-2 text-[15px] font-bold leading-snug">{s.shortTitle}</span>
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                {s.venueName}
                {s.barrio && ` · ${s.barrio}`}
              </span>
              {s.why && <span className="mt-1 block text-[13px] leading-snug text-foreground/85">{s.why}</span>}
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {s.price && <Badge variant={/gratis|libre/i.test(s.price) ? "success" : "secondary"}>{s.price}</Badge>}
                {s.walkMinutes != null && <Badge variant="outline">a {s.walkMinutes} min caminando</Badge>}
              </span>
            </>
          );
          const marker = (
            <span
              aria-hidden
              className="absolute -left-7 top-3 flex size-6 items-center justify-center rounded-full border border-white/15 bg-card text-[11px] font-bold"
              style={category ? { color: CATEGORY_COLORS[category] } : undefined}
            >
              {category ? <CategoryIcon category={category} className="size-3.5" /> : i + 1}
            </span>
          );
          return (
            <li key={`${s.time}-${i}`} className="stop-reveal relative" style={{ animationDelay: `${i * 100}ms` }}>
              {marker}
              {id ? (
                <Link
                  href={`/evento/${id}`}
                  onClick={(e) => {
                    if (!onPick) return;
                    e.preventDefault();
                    onPick(s);
                  }}
                  className="surface tap block p-3"
                >
                  {inner}
                </Link>
              ) : (
                <div className="surface block p-3">{inner}</div>
              )}
            </li>
          );
        })}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`pending-${i}`} className="relative" aria-hidden>
            <span className="absolute -left-7 top-3 size-6 rounded-full border border-white/10 bg-card" />
            <div className="surface space-y-2 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </li>
        ))}
      </ol>

      {plan.outro && <p className="text-[15px] leading-[1.45] text-muted-foreground">{plan.outro}</p>}
      {status === "done" && plan.stops.length > 0 && <WhatsAppButton text={text} className="w-full" />}
      {status === "done" && plan.stops.length === 0 && (
        <p className="text-[15px] text-muted-foreground">Para eso hoy no encontré nada. Probá con otro día o con más presupuesto.</p>
      )}
    </div>
  );
}
