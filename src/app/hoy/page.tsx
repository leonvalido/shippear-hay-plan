import type { Metadata } from "next";
import { Concierge } from "@/components/concierge/concierge";

export const metadata: Metadata = { title: "Qué hago hoy" };

export default function HoyPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-bold leading-tight">¿Qué hacés hoy?</h1>
      <p className="mb-6 mt-2 text-base text-muted-foreground">Decime cuándo salís y cuánto querés gastar. Lo demás lo armo yo.</p>
      <Concierge />
    </div>
  );
}
