"use client";

import { useEffect, useRef, useState } from "react";

/* Minimal typing for the Web Speech API (Chrome, Safari as webkitSpeechRecognition). */
type ResultEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type Ctor = new () => Recognition;

export function speechCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "No tenemos permiso para usar el micrófono. Activalo en el navegador.",
  "service-not-allowed": "El navegador no deja usar el micrófono acá.",
  "no-speech": "No escuché nada. Probá de nuevo, más cerca del micrófono.",
  "audio-capture": "No encontramos un micrófono.",
  network: "Sin conexión para reconocer la voz. Probá de nuevo.",
  aborted: "",
};

type Options = {
  /** Called on every interim result and with the final text; write it into the input. */
  onText: (text: string, final: boolean) => void;
  /** Called once with the final transcript, only when it is not empty. */
  onFinal: (text: string) => void;
};

/**
 * Speech-to-text for the concierge. The recognizer is created inside the click handler (user gesture),
 * es-AR, interim results on, one phrase per press. Hidden where the API is missing (e.g. Chrome on iOS).
 */
export function useSpeech({ onText, onFinal }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const cb = useRef({ onText, onFinal });
  cb.current = { onText, onFinal };

  useEffect(() => {
    setSupported(speechCtor() !== null && (window.isSecureContext || location.hostname === "localhost"));
    return () => recRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const C = speechCtor();
    if (!C) return;
    const rec = new C();
    rec.lang = "es-AR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    setError(null);
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) final += t;
        else interim += t;
      }
      if (final) finalRef.current = final.trim();
      cb.current.onText((final || interim).trim(), !!final);
    };
    rec.onerror = (e) => {
      const msg = ERRORS[e.error] ?? "No pudimos reconocer la voz. Probá de nuevo.";
      if (msg) setError(msg);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (text) {
        cb.current.onText(text, true);
        cb.current.onFinal(text);
      }
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("No pudimos arrancar el micrófono. Probá de nuevo.");
      setListening(false);
    }
  }

  return { supported, listening, error, toggle };
}
