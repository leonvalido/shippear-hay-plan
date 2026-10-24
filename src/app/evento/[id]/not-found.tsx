import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EventoNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-xl font-semibold">Ese evento no existe</h1>
      <p className="mt-2 text-base text-muted-foreground">Puede que se haya borrado o que el link esté mal.</p>
      <Button asChild className="tap mt-6 h-11 rounded-full px-6 text-base">
        <Link href="/mapa">Ir al mapa</Link>
      </Button>
    </div>
  );
}
