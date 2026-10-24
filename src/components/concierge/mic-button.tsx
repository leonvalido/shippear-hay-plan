"use client";

import { Button } from "@/components/ui/button";
import { useSpeech } from "./use-speech";

type Props = { onResult: (text: string) => void; onText?: (text: string) => void; disabled?: boolean };

/** Dictate "ganas de…" in es-AR. Renders nothing when the browser has no SpeechRecognition. */
export function MicButton({ onResult, onText, disabled }: Props) {
  const speech = useSpeech({ onText: (t) => onText?.(t), onFinal: onResult });
  if (!speech.supported) return null;
  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={speech.toggle}
        disabled={disabled}
        aria-pressed={speech.listening}
        aria-label={speech.listening ? "Dejar de escuchar" : "Decir qué tenés ganas de hacer"}
        title={speech.listening ? "Escuchando…" : "Preguntar por voz"}
        className={`size-11 rounded-full border-white/8 ${speech.listening ? "animate-pulse bg-primary/20 text-primary" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      </Button>
      {speech.error && (
        <p role="alert" className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg bg-destructive/15 px-3 py-1.5 text-[13px] text-foreground shadow-lg">
          {speech.error}
        </p>
      )}
    </div>
  );
}
