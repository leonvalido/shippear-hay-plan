"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DAY_LABELS, type DayFilter } from "@/components/events/format";
import { useSpeech } from "@/components/concierge/use-speech";
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

/** The concierge, floating over the map: a glowing glass card with the question and the filters. */
export function ConciergeBar({ day, onDay, budget, onBudget, near, onNear, locating, busy, autoFocus, onSubmit, className }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const speech = useSpeech({
    onText: (t) => setText(t),
    onFinal: (t) => {
      if (t.trim()) onSubmit(t.trim());
    },
  });

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    onSubmit(text.trim());
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
          placeholder={speech.listening ? "Escuchando…" : "¿Qué hacés hoy? Contame…"}
          aria-label="Contale al concierge qué tenés ganas de hacer"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Dejar de escuchar" : "Decirlo por voz"}
            className={cn("tap flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/8", speech.listening && "animate-pulse bg-primary/20 text-primary")}
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

      {speech.error && (
        <p role="alert" className="mt-2 rounded-lg bg-destructive/15 px-3 py-1.5 text-[13px] text-foreground">
          {speech.error}
        </p>
      )}
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
