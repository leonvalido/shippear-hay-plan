"use client";

import { Button } from "@/components/ui/button";

type Props = { text: string; className?: string };

/** Opens WhatsApp (app or web) with the plan and a link back to the map. */
export function WhatsAppButton({ text, className }: Props) {
  function send() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const body = `${text.trim()}\n\nMás planes en el mapa: ${origin}/mapa`;
    window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <Button type="button" onClick={send} className={className} style={{ background: "#25D366", color: "#fff" }}>
      Mandar por WhatsApp
    </Button>
  );
}
