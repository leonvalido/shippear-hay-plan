"use client";

import { useState } from "react";
import { AIResult } from "@/components/ai-result";
import { FilterChips } from "@/components/map/filter-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStream } from "@/hooks/use-stream";
import { MicButton } from "./mic-button";
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

  return (
    <div className="space-y-6">
      <section className="glass space-y-5 rounded-2xl p-4 sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">¿Cuándo?</p>
          <FilterChips label="Cuándo" chips={WHEN_CHIPS} value={when} onChange={(v) => v && setWhen(v)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="budget">Presupuesto</Label>
            <span className="text-sm font-semibold" aria-live="polite">
              {BUDGETS[budgetIdx].label}
            </span>
          </div>
          <input
            id="budget"
            type="range"
            min={0}
            max={BUDGETS.length - 1}
            step={1}
            value={budgetIdx}
            onChange={(e) => setBudgetIdx(Number(e.target.value))}
            className="w-full accent-primary"
            aria-valuetext={BUDGETS[budgetIdx].label}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            {BUDGETS.map((b) => (
              <span key={b.label}>{b.label}</span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mood">
            Ganas de… <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <div className="flex gap-2">
            <Input id="mood" maxLength={200} placeholder="Ej: algo tranqui al aire libre, con amigos" value={mood} onChange={(e) => setMood(e.target.value)} />
            <MicButton onResult={onVoice} disabled={busy} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
              {locating ? "Ubicando…" : "Usar mi ubicación"}
            </Button>
            <span className="text-sm text-muted-foreground">{loc ? loc.label : "Sin ubicación: buscamos en toda la ciudad"}</span>
          </div>
          {locError && <p className="text-xs text-muted-foreground">{locError}</p>}
        </div>

        <div className="flex gap-2">
          <Button size="lg" className="flex-1 font-semibold" onClick={() => ai.run(body())} disabled={busy}>
            {busy ? "Armando el plan…" : "Preguntale al concierge"}
          </Button>
          {busy && (
            <Button size="lg" variant="outline" onClick={ai.abort}>
              Parar
            </Button>
          )}
        </div>
      </section>

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
      {ai.status === "done" && ai.text.trim() && (
        <div className="flex justify-end">
          <WhatsAppButton text={ai.text} className="w-full sm:w-auto" />
        </div>
      )}
    </div>
  );
}
