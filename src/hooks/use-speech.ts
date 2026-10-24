"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typing for the Web Speech API (Chrome, Safari as webkitSpeechRecognition). */
type ResultEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type ErrorEvent = { error: string; message?: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type Ctor = new () => Recognition;

export function speechCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "No tenemos permiso para usar el micrófono. Activalo en el navegador.",
  "service-not-allowed": "El navegador no deja usar el micrófono acá.",
  "no-speech": "No escuché nada. Esperá a que diga «Escuchando» y hablá cerca del micrófono.",
  "audio-capture": "No pudimos abrir el micrófono. Fijate que ninguna otra app lo esté usando.",
  network: "Sin conexión para reconocer la voz. Probá de nuevo.",
  "language-not-supported": "El navegador no reconoce español acá.",
  aborted: "",
};
const GENERIC_ERROR = "No pudimos reconocer la voz. Probá de nuevo.";
const START_FAILED = "No pudimos arrancar el micrófono. Probá de nuevo.";
const WARMUP_TIMEOUT = "El micrófono tarda en arrancar. Probá de nuevo.";

/** Chrome needs 3 to 5 s to open the microphone after start(); past this it has hung (seen: audio-capture after 15 s). */
const WARMUP_MS = 12_000;
/** While the browser's own permission prompt may be open, nothing fires until the user answers it. */
const WARMUP_WITH_PROMPT_MS = 60_000;
const ERROR_VISIBLE_MS = 5_000;

/** "granted" when we know the mic is already allowed; "unknown" where the query is unsupported (Safari). */
async function micPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return p.state;
  } catch {
    return "unknown";
  }
}

export type SpeechStatus = "idle" | "starting" | "listening" | "error";

type Options = {
  /** Called on every interim result and with the final text; write it into the input. */
  onText: (text: string, final: boolean) => void;
  /** Called once per phrase with the final transcript, only when it is not empty. */
  onFinal: (text: string) => void;
  lang?: string;
};

/**
 * Speech-to-text for the concierge (es-AR, interim results, one phrase per press).
 *
 * - The recognizer is created and started inside the click handler (user gesture) and kept in a ref.
 * - `status` is "starting" from start() until the browser reports audio capture ("listening"): Chrome takes
 *   3 to 5 s to open the mic, and speech before that is lost, so the UI must not say "Escuchando" yet.
 * - On `end` the last transcript is sent whether or not the browser flagged it final: Chrome ends a
 *   non-continuous session with only interim results often enough that waiting for `isFinal` silently drops the phrase.
 * - A watchdog aborts a recognizer that never reaches audio capture, so the button cannot stay stuck.
 * - `supported` is false where the API is missing (Chrome on iOS, Firefox) or the context is not secure.
 */
export function useSpeech({ onText, onFinal, lang = "es-AR" }: Options) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef({ onText, onFinal });
  cb.current = { onText, onFinal };

  useEffect(() => {
    setSupported(speechCtor() !== null && (window.isSecureContext || location.hostname === "localhost"));
    return () => {
      recRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => {
      setError(null);
      setStatus((s) => (s === "error" ? "idle" : s));
    }, ERROR_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [error]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (recRef.current) return;
    const C = speechCtor();
    if (!C) return;

    const rec = new C();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = "";
    let lastText = "";
    let failed = false;

    const clearWatchdog = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const heard = () => {
      clearWatchdog();
      setStatus((s) => (s === "starting" ? "listening" : s));
    };

    rec.onstart = () => setStatus("starting");
    rec.onaudiostart = heard;
    rec.onsoundstart = heard;
    rec.onspeechstart = heard;
    rec.onresult = (e) => {
      heard();
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) final += t;
        else interim += t;
      }
      if (final) finalText = final.trim();
      lastText = (final || interim).trim();
      cb.current.onText(lastText, !!final);
    };
    rec.onerror = (e) => {
      clearWatchdog();
      failed = true;
      const msg = SPEECH_ERRORS[e.error] ?? GENERIC_ERROR;
      if (msg) {
        setError(msg);
        setStatus("error");
      } else {
        setStatus("idle");
      }
    };
    rec.onend = () => {
      clearWatchdog();
      recRef.current = null;
      setStatus((s) => (s === "error" ? s : "idle"));
      const text = (finalText || lastText).trim();
      if (text && !failed) {
        cb.current.onText(text, true);
        cb.current.onFinal(text);
      }
    };

    recRef.current = rec;
    setError(null);
    setStatus("starting");

    try {
      rec.start();
    } catch {
      recRef.current = null;
      setError(START_FAILED);
      setStatus("error");
      return;
    }

    void micPermission().then((perm) => {
      if (recRef.current !== rec || timerRef.current) return;
      timerRef.current = setTimeout(
        () => {
          if (recRef.current !== rec) return;
          failed = true;
          setError(WARMUP_TIMEOUT);
          setStatus("error");
          rec.abort();
        },
        perm === "granted" ? WARMUP_MS : WARMUP_WITH_PROMPT_MS,
      );
    });
  }, [lang]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return {
    supported,
    status,
    /** Audio is being captured: safe to speak. */
    listening: status === "listening",
    /** Mic requested, capture not started yet: tell the user to wait. */
    starting: status === "starting",
    /** True while a recognizer exists (starting or listening); drives aria-pressed. */
    active: status === "starting" || status === "listening",
    error,
    start,
    stop,
    toggle,
  };
}
