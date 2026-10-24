"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/* Minimal typing for the Web Speech API (not in lib.dom for every TS config). */
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props = { onResult: (text: string) => void; disabled?: boolean };

/** Dictate "ganas de…" in es-AR. Renders nothing when the browser has no SpeechRecognition. */
export function MicButton({ onResult, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onResult(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <Button
      type="button"
      variant={listening ? "destructive" : "outline"}
      size="icon"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Dejar de escuchar" : "Decir qué tenés ganas de hacer"}
      title="Preguntar por voz"
      className={listening ? "animate-pulse" : undefined}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </svg>
    </Button>
  );
}
