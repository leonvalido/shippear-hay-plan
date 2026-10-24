"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { title: string; text?: string; path: string; className?: string };

/** Web Share API when available (phones), clipboard fallback otherwise. */
export function ShareButton({ title, text, path, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        window.prompt("Copiá el link:", url);
      }
    }
  }

  return (
    <Button type="button" variant="outline" onClick={share} aria-live="polite" className={cn(className)}>
      {copied ? "Link copiado ✓" : "Compartir"}
    </Button>
  );
}
