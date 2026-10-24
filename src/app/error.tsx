"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Global error boundary: one line, one suggestion, retry. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold tracking-[-0.02em]">Se nos trabó algo</h1>
      <p className="mt-2 text-base text-muted-foreground">No es tu culpa. Probá de nuevo y, si sigue, volvé al mapa.</p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" className="tap h-12 rounded-full px-8" onClick={() => reset()}>
          Probar de nuevo
        </Button>
        <Button asChild size="lg" variant="outline" className="tap h-12 rounded-full px-8">
          <Link href="/mapa">Ir al mapa</Link>
        </Button>
      </div>
    </div>
  );
}
