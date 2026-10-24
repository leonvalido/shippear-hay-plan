import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EventoNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Ese evento no existe</h1>
      <p className="mt-2 text-muted-foreground">Puede que se haya borrado o que el link esté mal.</p>
      <Button asChild className="mt-6">
        <Link href="/mapa">Ir al mapa</Link>
      </Button>
    </div>
  );
}
