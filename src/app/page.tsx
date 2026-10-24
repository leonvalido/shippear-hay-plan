import Link from "next/link";
import { fetchEvents } from "@/app/_lib/api";
import { dayRange } from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", title: "Fuentes públicas", desc: "Agenda municipal, ticketeras y prensa, en un solo lugar y al día." },
  { n: "02", title: "Redes sociales", desc: "Lo que se mueve en TikTok e Instagram, leído por Claude y sin repetidos." },
  { n: "03", title: "Recomendaciones", desc: "Decile cuándo salís y cuánto querés gastar, y te arma el plan." },
];

export default async function Home() {
  const week = await fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>);
  const count = week.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12 sm:py-20">
      <section className="space-y-6 text-center">
        <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <strong className="font-semibold text-foreground tabular-nums">{count}</strong> evento{count === 1 ? "" : "s"} esta semana
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold sm:text-7xl">
          ¿Qué hacés hoy?
          <br />
          <span className="text-primary">Hay plan.</span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          El mapa de lo que pasa hoy en Rosario, con un chat que te dice qué hacer.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link href="/mapa">Ver en el mapa</Link>
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
    </div>
  );
}
