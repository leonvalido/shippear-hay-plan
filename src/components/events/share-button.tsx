"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { title: string; text?: string; path: string; className?: string; iconOnly?: boolean };

/** Web Share API when available (phones), clipboard fallback otherwise. */
export function ShareButton({ title, text, path, className, iconOnly }: Props) {
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
      if ((err as Error).name !== "AbortError") window.prompt("Copiá el link:", url);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={share}
      aria-label={copied ? "Link copiado" : "Compartir"}
      title={copied ? "Link copiado" : "Compartir"}
      className={cn(iconOnly && "px-0", className)}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
      )}
      {!iconOnly && <span>{copied ? "Link copiado" : "Compartir"}</span>}
    </Button>
  );
}
