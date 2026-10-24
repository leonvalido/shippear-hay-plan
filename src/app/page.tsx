import Link from "next/link";
import { fetchEvents } from "@/app/_lib/api";
import { dayRange } from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", title: "El mapa de hoy", desc: "Junta en un solo mapa lo que pasa hoy en la agenda municipal, los teatros y los bares de Rosario." },
  { n: "02", title: "El concierge", desc: "Le decís qué tenés ganas de hacer y a qué hora salís, y te contesta con eventos de hoy, con hora, lugar y precio." },
  { n: "03", title: "El plan de esta noche", desc: "Guardás el que te gusta, tocás \"Cómo llegar\" y salís." },
];

export default async function Home() {
  const week = await fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>);
  const count = week.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12 sm:py-20">
      <section className="space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Shippear #3 · Rosario</p>
        <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <strong className="font-semibold text-foreground tabular-nums">{count}</strong> evento{count === 1 ? "" : "s"} esta semana
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold sm:text-7xl">Mirá qué pasa hoy en Rosario.</h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Ves en un mapa los recitales, las ferias, el teatro y las fiestas de hoy, con hora, lugar y precio de la entrada.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link href="/mapa">Abrir el mapa</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
            <Link href="/hoy">Preguntale al concierge</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.title} className="glass gap-3 py-5">
            <CardHeader>
              <div className="font-display text-sm font-semibold text-primary" aria-hidden>
                {s.n}
              </div>
              <CardTitle className="pt-1">{s.title}</CardTitle>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <footer className="text-center text-sm text-muted-foreground">
        <span className="font-display font-semibold text-foreground">¿Qué hacés hoy? Hay plan.</span>
      </footer>
    </div>
  );
}
