import type { Metadata } from "next";
import { Concierge } from "@/components/concierge/concierge";

export const metadata: Metadata = { title: "Qué hago hoy" };

export default function HoyPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">¿Qué hago hoy?</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Contanos un poco y te armamos el plan con lo que hay en Rosario.</p>
      <Concierge />
    </div>
  );
}
