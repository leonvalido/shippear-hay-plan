import Link from "next/link";
import { fetchEvents } from "@/app/_lib/api";
import { HeroMap } from "@/components/layout/hero-map";
import { PhoneFrame } from "@/components/layout/phone-frame";
import { CATEGORY_COLORS, CATEGORY_LABELS, dayRange, displayTitle, formatTime, humanizeTitle, timeLabel } from "@/components/events/format";
import { Button } from "@/components/ui/button";
import type { Event } from "@/lib/events/schema";

export const dynamic = "force-dynamic";

const PUBLIC_SOURCES = new Set(["municipal", "ticketing", "platform", "press"]);

function sourceBase(name?: string) {
  return (name ?? "").split("·")[0].trim().toLowerCase();
}

/** Tonight first (from 17:00), then the rest of today, then what comes next. */
function pickTonight(today: Event[], week: Event[]): { title: string; events: Event[] } {
  const hour = (e: Event) => Number(formatTime(e.startsAt).slice(0, 2));
  const evening = today.filter((e) => !e.timeUnknown && hour(e) >= 17);
  const rest = today.filter((e) => !evening.includes(e));
  const upcoming = week.filter((e) => !today.some((t) => t.id === e.id));
  const events = [...evening, ...rest, ...upcoming].slice(0, 6);
  return { title: evening.length >= 3 ? "Esta noche en Rosario" : "Hoy en Rosario", events };
}

export default async function Home() {
  const [week, today] = await Promise.all([
    fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>),
    fetchEvents({ ...dayRange("hoy"), limit: "500" } as Record<string, string>),
  ]);
  const count = week.length;
  const tonight = pickTonight(today, week);
  const publicSources = new Set(week.filter((e) => PUBLIC_SOURCES.has(e.sourceType)).map((e) => sourceBase(e.sourceName)).filter(Boolean)).size;
  const social = week.filter((e) => e.sourceType === "tiktok" || e.sourceType === "instagram").length;
  const freeToday = today.filter((e) => e.price?.free).length;
  const barriosToday = new Set(today.map((e) => e.barrio).filter(Boolean)).size;

  const stats: { n: number; label: string }[] = [
    { n: publicSources, label: `fuente${publicSources === 1 ? "" : "s"} pública${publicSources === 1 ? "" : "s"} leída${publicSources === 1 ? "" : "s"} por IA` },
    social > 0 ? { n: social, label: "eventos encontrados en TikTok e Instagram" } : { n: freeToday, label: `plan${freeToday === 1 ? "" : "es"} gratis hoy` },
    { n: barriosToday, label: `barrio${barriosToday === 1 ? "" : "s"} con planes hoy` },
  ];

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
            <ul className="flex flex-wrap justify-center gap-2 xl:justify-start" aria-label="Categorías">
              {(["musica", "fiesta", "feria"] as const).map((c) => (
                <li key={c}>
                  <Link href={`/mapa?category=${c}`} className="glass tap inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                    {CATEGORY_LABELS[c]}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col justify-center gap-3 sm:flex-row xl:justify-start">
              <Button asChild size="lg" className="tap h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto">
                <Link href="/mapa">Abrir el mapa</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="tap h-12 w-full rounded-full px-8 text-base sm:w-auto">
                <Link href="/hoy">Preguntale al concierge</Link>
              </Button>
            </div>
          </div>
          <PhoneFrame src="/mapa" className="hidden justify-self-end xl:block" />
        </div>
      </section>

      {/* Real content as decoration: tonight's events straight from the API. */}
      {tonight.events.length > 0 && (
        <section className="mx-auto w-full max-w-[1200px] px-4 pb-6 pt-2 sm:px-6 sm:pb-12">
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
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
        </section>
      )}

      {/* Three statements, real numbers, no card chrome. */}
      <section className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {stats.map((s, i) => (
            <li key={s.label} className="border-t border-white/10 pt-5">
              <p className="text-xs font-bold tracking-widest text-tertiary">0{i + 1}</p>
              <p className="mt-3 text-4xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-5xl">{s.n}</p>
              <p className="mt-1 max-w-[22ch] text-base text-muted-foreground">{s.label}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
