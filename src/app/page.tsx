import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-4 py-10">
      <section className="space-y-6 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Todo lo que pasa en Rosario, en un mapa.
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          HayPlan junta recitales, ferias, teatro y fiestas de fuentes públicas, redes y flyers, y te recomienda qué hacer hoy.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/mapa">Ver el mapa</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Fuentes públicas", "Agenda municipal, ticketeras y prensa, en un solo lugar."],
          ["Redes y flyers", "Sacale una foto a un flyer y Claude lo lee y lo sube al mapa."],
          ["Recomendaciones", "Decinos cuándo y cuánto querés gastar, y te armamos el plan."],
        ].map(([title, desc]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </div>
  );
}
