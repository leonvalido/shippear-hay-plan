"use client";

import { useState } from "react";
import { AIResult } from "@/components/ai-result";
import { FilterChips } from "@/components/map/filter-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStream } from "@/hooks/use-stream";
import { MicButton } from "./mic-button";
import { PlanStops, parseStops } from "./plan-stops";
import { parsePlan } from "./plan-stream";
import { PlanView } from "./plan-view";
import { WhatsAppButton } from "./whatsapp-button";
import { ROSARIO_CENTER } from "@/lib/events/schema";

type When = "hoy" | "manana" | "finde";
const WHEN_CHIPS: { value: When; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Mañana" },
  { value: "finde", label: "Finde" },
];

/** Slider stops: index → { label, budget sent to the API (undefined = no limit) }. */
const BUDGETS = [
  { label: "Gratis", value: 0 },
  { label: "Hasta $10 mil", value: 10_000 },
  { label: "Hasta $30 mil", value: 30_000 },
  { label: "Lo que sea", value: undefined },
] as const;

type Loc = { lat: number; lng: number; label: string };

/** The concierge: a few taps → a streamed recommendation in rioplatense Spanish. */
export function Concierge() {
  const [when, setWhen] = useState<When>("hoy");
  const [budgetIdx, setBudgetIdx] = useState(3);
  const [mood, setMood] = useState("");
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const ai = useStream("/api/concierge");

  function locate() {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLoc({ ...ROSARIO_CENTER, label: "Centro de Rosario" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Tu ubicación" });
        setLocating(false);
      },
      () => {
        setLoc({ ...ROSARIO_CENTER, label: "Centro de Rosario" });
        setLocError("No pudimos ubicarte, usamos el centro de Rosario.");
        setLocating(false);
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  function body(moodOverride?: string) {
    const m = (moodOverride ?? mood).trim();
    return {
      when,
      lat: loc?.lat,
      lng: loc?.lng,
      budget: BUDGETS[budgetIdx].value,
      mood: m || undefined,
    };
  }

  /** Voice input: fill the field and ask right away. */
  function onVoice(text: string) {
    setMood(text);
    ai.run(body(text));
  }

  const busy = ai.status === "loading" || ai.status === "streaming";
  const parsed = parsePlan(ai.text, ai.status === "done");
  const stops = ai.status === "done" && parsed.mode === "text" ? parseStops(ai.text) : [];

  return (
    <div className="space-y-6">
      <section className="surface space-y-6 p-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">¿Cuándo?</p>
          <FilterChips label="Cuándo" chips={WHEN_CHIPS} value={when} onChange={(v) => v && setWhen(v)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="budget" className="text-sm font-normal text-muted-foreground">Presupuesto</Label>
            <span className="text-sm font-semibold text-foreground" aria-live="polite">
              {BUDGETS[budgetIdx].label}
            </span>
          </div>
          <div className="rounded-xl border border-white/8 px-3 py-1">
          <input
            id="budget"
            type="range"
            min={0}
            max={BUDGETS.length - 1}
            step={1}
            value={budgetIdx}
            onChange={(e) => setBudgetIdx(Number(e.target.value))}
            className="block h-11 w-full accent-primary"
            aria-valuetext={BUDGETS[budgetIdx].label}
          />
          <div className="flex justify-between gap-2 pb-2 text-xs leading-tight text-tertiary">
            {BUDGETS.map((b) => (
              <span key={b.label} className="min-w-0 text-center first:text-left last:text-right">{b.label}</span>
            ))}
          </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mood" className="text-sm font-normal text-muted-foreground">
            Ganas de… <span className="text-tertiary">(opcional)</span>
          </Label>
          <div className="flex gap-2">
            <Input id="mood" className="h-11 min-w-0 rounded-xl border-white/8" maxLength={200} placeholder="Ej: algo tranqui al aire libre" value={mood} onChange={(e) => setMood(e.target.value)} />
            <MicButton onResult={onVoice} onText={setMood} disabled={busy} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Ubicación</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={locate} disabled={locating} aria-label="Usar mi ubicación" className="h-11 rounded-full border-white/8 px-4">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {locating ? "Ubicando…" : "Mi ubicación"}
            </Button>
            <span className="text-sm text-tertiary">{loc ? loc.label : "Sin ubicación: buscamos en toda la ciudad"}</span>
          </div>
          {locError && <p className="text-sm text-tertiary">{locError}</p>}
        </div>

        <div className="flex gap-2">
          <Button size="lg" className="h-11 flex-1 rounded-full font-semibold" onClick={() => ai.run(body())} disabled={busy}>
            {busy ? "Armando el plan…" : "Preguntale al concierge"}
          </Button>
          {busy && (
            <Button size="lg" variant="outline" className="h-11 rounded-full border-white/8" onClick={ai.abort}>
              Parar
            </Button>
          )}
        </div>
      </section>

      {ai.status !== "idle" && parsed.mode !== "text" && ai.status !== "error" && (
        <section className="surface space-y-3 p-4">
          <h2 className="text-lg font-semibold">Tu plan</h2>
          <PlanView plan={parsed} status={ai.status} />
        </section>
      )}
      {ai.status !== "idle" && (parsed.mode === "text" || ai.status === "error") && (
      <AIResult
        title="Tu plan"
        status={ai.status}
        text={ai.text}
        error={ai.error}
        mode={ai.mode}
        onRetry={() => ai.run(body())}
        emptyHint="Hola, soy HayPlan. Decime qué tenés ganas de hacer o a qué hora salís y te armo algo con lo que hay hoy en Rosario."
        className="min-h-40"
      />
      )}
      {stops.length > 0 && <PlanStops stops={stops} />}
      {parsed.mode === "text" && ai.status === "done" && ai.text.trim() && (
        <div className="flex justify-end">
          <WhatsAppButton text={ai.text} className="w-full sm:w-auto" />
        </div>
      )}
    </div>
  );
}
