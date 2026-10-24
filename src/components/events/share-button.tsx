"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = { title: string; text?: string; path: string };

/** Web Share API when available (phones), clipboard fallback otherwise. */
export function ShareButton({ title, text, path }: Props) {
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
    <Button type="button" variant="outline" onClick={share} aria-live="polite">
      {copied ? "Link copiado ✓" : "Compartir"}
    </Button>
  );
}
