import Link from "next/link";
import { fetchEvents } from "@/app/_lib/api";
import { HeroMap } from "@/components/layout/hero-map";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/components/events/format";
import { dayRange } from "@/components/events/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ICONS = {
  pin: (
    <>
      <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  chat: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7" />
      <path d="m15 3.5 2.5 2.5L15 8.5" />
    </>
  ),
};

const STEPS: { icon: keyof typeof ICONS; title: string; desc: string }[] = [
  { icon: "pin", title: "El mapa de hoy", desc: "Junta en un solo mapa lo que pasa hoy en la agenda municipal, los teatros y los bares de Rosario." },
  { icon: "chat", title: "El concierge", desc: "Le decís qué tenés ganas de hacer y a qué hora salís, y te contesta con eventos de hoy, con hora, lugar y precio." },
  { icon: "route", title: "El plan de esta noche", desc: "Elegís el que te gusta, tocás \"Cómo llegar\" y salís." },
];

export default async function Home() {
  const week = await fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>);
  const count = week.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:space-y-14 sm:py-20">
      <section className="relative space-y-4 py-6 text-center sm:space-y-6">
        <HeroMap />
        <p className="relative text-sm font-medium tracking-wide text-muted-foreground">Shippear #3 · Rosario</p>
        <p className="glass relative inline-flex items-center gap-2 h-8 rounded-full px-3 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <strong className="font-semibold text-foreground tabular-nums">{count}</strong> evento{count === 1 ? "" : "s"} esta semana
        </p>
        <h1 className="relative mx-auto max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-6xl">Mirá qué pasa hoy en Rosario.</h1>
        <p className="relative mx-auto max-w-xl text-base text-muted-foreground">
          Ves en un mapa los recitales, las ferias, el teatro y las fiestas de hoy, con hora, lugar y precio de la entrada.
        </p>
        <ul className="relative flex flex-wrap justify-center gap-2" aria-label="Categorías">
          {(["musica", "fiesta", "feria"] as const).map((c) => (
            <li key={c}>
              <Link
                href={`/mapa?category=${c}`}
                className="glass tap inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium"
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                {CATEGORY_LABELS[c]}
              </Link>
            </li>
          ))}
        </ul>
        <div className="relative flex flex-col justify-center gap-3 sm:flex-row sm:gap-3">
          <Button asChild size="lg" className="tap h-12 w-full rounded-full px-8 text-base sm:w-auto">
            <Link href="/mapa">Abrir el mapa</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="tap h-12 w-full rounded-full px-8 text-base sm:w-auto">
            <Link href="/hoy">Preguntale al concierge</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.title} className="surface p-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[s.icon]}
              </svg>
            </div>
            <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
            <p className="mt-1 text-base text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </section>

      <footer className="pb-2 text-center text-sm text-muted-foreground">
        <span className="font-display font-semibold text-foreground">¿Qué hacés hoy? Hay plan.</span>
      </footer>
    </div>
  );
}
