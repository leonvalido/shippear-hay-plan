import Link from "next/link";
import { HeroMap } from "@/components/layout/hero-map";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative flex flex-1 overflow-hidden">
      <HeroMap />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-sm font-semibold tracking-wide text-tertiary">404</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">Esa página no existe</h1>
        <p className="mt-3 text-base text-muted-foreground">Capaz el link está mal, o el plan ya pasó. El mapa sigue ahí.</p>
        <Button asChild size="lg" className="tap mt-8 h-12 rounded-full px-8 text-base font-semibold">
          <Link href="/mapa">Ir al mapa</Link>
        </Button>
      </div>
    </section>
  );
}
