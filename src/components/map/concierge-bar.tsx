"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DAY_LABELS, type DayFilter } from "@/components/events/format";
import { cn } from "@/lib/utils";

export type Budget = 0 | 10000 | 30000 | null;

export const BUDGET_CHIPS: { value: Budget; label: string }[] = [
  { value: 0, label: "Gratis" },
  { value: 10000, label: "$10 mil" },
  { value: 30000, label: "$30 mil" },
  { value: null, label: "Lo que sea" },
];

const WHEN: DayFilter[] = ["hoy", "manana", "finde"];

type Props = {
  day: DayFilter | null;
  onDay: (d: DayFilter | null) => void;
  budget: Budget;
  onBudget: (b: Budget) => void;
  near: boolean;
  onNear: (on: boolean) => void;
  locating?: boolean;
  busy?: boolean;
  autoFocus?: boolean;
  onSubmit: (text: string) => void;
  className?: string;
};

/* Minimal typing for the Web Speech API. */
type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; abort: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionCtor = new () => Recognition;
function speechCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The concierge, floating over the map: a glowing glass card with the question and the filters. */
export function ConciergeBar({ day, onDay, budget, onBudget, near, onNear, locating, busy, autoFocus, onSubmit, className }: Props) {
  const [text, setText] = useState("");
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setCanSpeak(speechCtor() !== null);
    if (autoFocus) inputRef.current?.focus();
    return () => recRef.current?.abort();
  }, [autoFocus]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    onSubmit(text.trim());
  }

  function speak() {
    if (listening) return recRef.current?.stop();
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript?.trim();
      if (t) {
        setText(t);
        onSubmit(t);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <form onSubmit={submit} className={cn("hp-glow glass rounded-[20px] p-2", className)} aria-label="Concierge">
      <div className="flex h-11 items-center gap-1 rounded-full bg-white/5 pl-4 pr-1">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="¿Qué hacés hoy? Contame…"
          aria-label="Contale al concierge qué tenés ganas de hacer"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {canSpeak && (
          <button
            type="button"
            onClick={speak}
            aria-pressed={listening}
            aria-label={listening ? "Dejar de escuchar" : "Decirlo por voz"}
            className={cn("tap flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/8", listening && "animate-pulse text-primary")}
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          aria-label="Pedir un plan"
          className="tap flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
        >
          {busy ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
          ) : (
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [touch-action:pan-x] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] md:flex-wrap md:overflow-visible md:[mask-image:none]">
        <div role="group" aria-label="Cuándo" className="flex shrink-0 gap-1.5">
          {WHEN.map((d) => (
            <Chip key={d} active={day === d} onClick={() => onDay(day === d ? null : d)}>
              {DAY_LABELS[d]}
            </Chip>
          ))}
        </div>
        <span aria-hidden className="my-1.5 w-px shrink-0 bg-white/10 md:hidden" />
        <span aria-hidden className="hidden h-0 basis-full md:block" />
        <div role="group" aria-label="Presupuesto" className="flex shrink-0 gap-1.5">
          {BUDGET_CHIPS.map((b) => (
            <Chip key={b.label} active={budget === b.value} onClick={() => onBudget(b.value)}>
              {b.label}
            </Chip>
          ))}
        </div>
        <span aria-hidden className="my-1.5 w-px shrink-0 bg-white/10" />
        <Chip active={near} onClick={() => onNear(!near)} aria-label="Mostrar solo lo que está cerca mío">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
          {locating ? "Ubicando…" : "Cerca mío"}
        </Chip>
      </div>
    </form>
  );
}

function Chip({ active, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "tap flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap",
        active ? "border-primary bg-primary text-white" : "border-white/8 bg-white/5 text-foreground hover:bg-white/10",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
