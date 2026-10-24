"use client";

import Link from "next/link";
import { HeroMap } from "@/components/layout/hero-map";
import { Button } from "@/components/ui/button";

/** Global error boundary: one line, one suggestion, retry. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="relative flex flex-1 overflow-hidden">
      <HeroMap />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-sm font-semibold tracking-wide text-tertiary">Error</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">Se nos trabó algo</h1>
        <p className="mt-3 text-base text-muted-foreground">No es tu culpa. Probá de nuevo y, si sigue, volvé al mapa.</p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" className="tap h-12 rounded-full px-8 text-base font-semibold" onClick={() => reset()}>
            Probar de nuevo
          </Button>
          <Button asChild size="lg" variant="outline" className="tap h-12 rounded-full px-8 text-base">
            <Link href="/mapa">Ir al mapa</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
