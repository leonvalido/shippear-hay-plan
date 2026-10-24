import Image from "next/image";
import Link from "next/link";
import { apiBase, fetchEvents } from "@/app/_lib/api";
import { HeroMap } from "@/components/layout/hero-map";
import { PhoneFrame } from "@/components/layout/phone-frame";
import { CATEGORY_COLORS, CATEGORY_LABELS, dayRange, displayTitle, formatTime, humanizeTitle, timeLabel } from "@/components/events/format";
import type { EventCategory } from "@/lib/events/schema";
import { Button } from "@/components/ui/button";
import type { Event } from "@/lib/events/schema";

export const dynamic = "force-dynamic";

/** Tonight first (from 17:00), then the rest of today, then what comes next. */
function pickTonight(today: Event[], week: Event[]): { title: string; events: Event[] } {
  const hour = (e: Event) => Number(formatTime(e.startsAt).slice(0, 2));
  const evening = today.filter((e) => !e.timeUnknown && hour(e) >= 17);
  const rest = today.filter((e) => !evening.includes(e));
  const upcoming = week.filter((e) => !today.some((t) => t.id === e.id));
  const events = [...evening, ...rest, ...upcoming].slice(0, 6);
  return { title: evening.length >= 3 ? "Esta noche en Rosario" : "Hoy en Rosario", events };
}

/** "el Centro", "la Costanera", "Pichincha": barrios that read with an article in Rosario. */
function withArticle(barrio: string): string {
  if (["Centro", "Macrocentro", "Parque", "Sur", "Norte", "Oeste"].includes(barrio)) return `el ${barrio}`;
  if (barrio === "Costanera") return `la ${barrio}`;
  return barrio;
}

type Stats = { total: number; byBarrio: { barrio: string; count: number }[]; byCategory: { category: string; count: number }[] };

/** One quiet line of real numbers for the week: total, busiest barrio, most common category. */
async function fetchStatsLine(): Promise<string | null> {
  try {
    const qs = new URLSearchParams(dayRange("semana") as Record<string, string>).toString();
    const res = await fetch(`${await apiBase()}/api/events/stats?${qs}`, { cache: "no-store" });
    if (!res.ok) return null;
    const s = (await res.json()) as Stats;
    if (!s.total) return null;
    const parts = [`${s.total} eventos esta semana`];
    const barrio = s.byBarrio[0];
    if (barrio) parts.push(`${barrio.count} en ${withArticle(barrio.barrio)}`);
    const cat = s.byCategory[0];
    if (cat) parts.push(`${cat.count} de ${CATEGORY_LABELS[cat.category as EventCategory]?.toLowerCase() ?? cat.category}`);
    return parts.join(" · ");
  } catch {
    return null;
  }
}

export default async function Home() {
  const [week, today, statsLine] = await Promise.all([
    fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>),
    fetchEvents({ ...dayRange("hoy"), limit: "500" } as Record<string, string>),
    fetchStatsLine(),
  ]);
  const count = week.length;
  const tonight = pickTonight(today, week);

  return (
    <div className="w-full">
      {/* Hero: full-bleed pin field, content in a 1200px container, two columns from 1280px. */}
      <section className="relative overflow-hidden">
        <HeroMap />
        <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 py-12 sm:px-6 sm:py-20 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-20 xl:py-24">
          <div className="space-y-5 text-center sm:space-y-6 xl:text-left">
            <p className="text-sm font-semibold tracking-wide text-muted-foreground">Shippear #3 · Rosario</p>
            <p className="glass inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground" aria-live="polite">
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
              <strong className="font-semibold text-foreground tabular-nums">{count}</strong> evento{count === 1 ? "" : "s"} esta semana
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-balance sm:text-6xl xl:mx-0 xl:text-7xl">
              Mirá qué pasa hoy en Rosario.
            </h1>
            <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg xl:mx-0">
              Ves en un mapa los recitales, las ferias, el teatro y las fiestas de hoy, con hora, lugar y precio de la entrada.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row xl:justify-start">
              <Button asChild size="lg" className="tap h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto">
                <Link href="/mapa">Abrir el mapa</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="tap h-12 w-full rounded-full px-8 text-base sm:w-auto">
                <Link href="/mapa?concierge=1">Preguntale al concierge</Link>
              </Button>
            </div>
          </div>
          <PhoneFrame src="/mapa?embed=1" className="hidden justify-self-end xl:block" />
        </div>
      </section>

      {/* Real content as decoration: tonight's events straight from the API. */}
      {tonight.events.length > 0 && (
        <section className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-2 sm:px-6 sm:pb-24">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">{tonight.title}</h2>
            <Link href="/mapa" className="shrink-0 text-sm font-semibold text-primary hover:underline">
              Ver todo en el mapa →
            </Link>
          </div>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-pl-4 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:scroll-pl-0 xl:grid xl:grid-cols-6 xl:overflow-visible">
            {tonight.events.map((e) => (
              <li key={e.id} className="w-[200px] shrink-0 snap-start xl:w-auto">
                <Link href={`/evento/${e.id}`} className="tap group block overflow-hidden rounded-2xl">
                  <div
                    className="relative aspect-[4/5] w-full overflow-hidden"
                    style={{ background: `linear-gradient(160deg, color-mix(in oklch, ${CATEGORY_COLORS[e.category]} 70%, #000), color-mix(in oklch, ${CATEGORY_COLORS[e.category]} 25%, #000))` }}
                  >
                    {e.imageUrl && (
                      <Image
                        src={e.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 380px, 400px"
                        quality={85}
                        loading="lazy"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{timeLabel(e)}</p>
                      <p className="no-caps mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-white">{displayTitle(e)}</p>
                      <p className="mt-0.5 truncate text-[12px] text-white/70">{humanizeTitle(e.venueName)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {statsLine && <p className="mt-6 text-[13px] text-tertiary sm:mt-8">{statsLine}</p>}
        </section>
      )}

    </div>
  );
}
