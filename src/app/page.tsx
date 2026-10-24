import Link from "next/link";
import { fetchEvents } from "@/app/_lib/api";
import { dayRange } from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: "🏛️", title: "Fuentes públicas", desc: "Agenda municipal, ticketeras y prensa, en un solo lugar y actualizadas." },
  { icon: "📱", title: "Redes sociales", desc: "Lo que se mueve en TikTok e Instagram, leído por Claude y sin duplicados." },
  { icon: "✨", title: "Recomendaciones", desc: "Decinos cuándo y cuánto querés gastar, y te armamos el plan." },
];

export default async function Home() {
  const week = await fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>);
  const count = week.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12 sm:py-20">
      <section className="space-y-6 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <strong className="font-semibold text-foreground tabular-nums">{count}</strong> evento{count === 1 ? "" : "s"} esta semana
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Todo lo que pasa en Rosario, en un mapa.
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Recitales, ferias, teatro y fiestas de fuentes públicas y redes sociales, con un concierge que te dice qué hacer hoy.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link href="/mapa">Ver el mapa</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
            <Link href="/hoy">¿Qué hago hoy?</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.title} className="gap-3 py-5">
            <CardHeader>
              <div className="text-3xl" aria-hidden>
                {s.icon}
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
