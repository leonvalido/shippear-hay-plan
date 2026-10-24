"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EventCard } from "@/components/events/event-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Event, RawEvent } from "@/lib/events/schema";
import { DraftForm } from "./draft-form";

type FlyerResponse = { draft: RawEvent; confidence: number; duplicates: Event[]; mode: "mock" | "live" };

type Step =
  | { kind: "pick" }
  | { kind: "reading" }
  | { kind: "edit"; result: FlyerResponse }
  | { kind: "publishing"; result: FlyerResponse }
  | { kind: "done"; event: Event };

const MAX_BYTES = 5 * 1024 * 1024;

/** Phone flow: photo → Claude reads it → edit → publish. */
export function FlyerUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Elegí una imagen (jpg, png o webp).");
    if (f.size > MAX_BYTES) return setError("La imagen pesa más de 5 MB. Probá con una más chica.");
    setFile(f);
  }

  async function read() {
    if (!file) return;
    setError(null);
    setStep({ kind: "reading" });
    try {
      const body = new FormData();
      body.append("image", file);
      if (caption.trim()) body.append("caption", caption.trim());
      const res = await fetch("/api/flyer", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setStep({ kind: "edit", result: data as FlyerResponse });
    } catch (err) {
      setError((err as Error).message || "No pudimos leer el flyer.");
      setStep({ kind: "pick" });
    }
  }

  async function publish(result: FlyerResponse, raw: RawEvent) {
    setError(null);
    setStep({ kind: "publishing", result });
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setStep({ kind: "done", event: (data as { event: Event }).event });
    } catch (err) {
      setError((err as Error).message || "No se pudo publicar.");
      setStep({ kind: "edit", result });
    }
  }

  function reset() {
    setFile(null);
    setCaption("");
    setError(null);
    setStep({ kind: "pick" });
  }

  if (step.kind === "done") {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-600/40 bg-emerald-50 p-6 text-center dark:bg-emerald-950/30">
        <div className="text-4xl" aria-hidden>🎉</div>
        <h2 className="text-xl font-bold">¡Listo! Tu evento ya está cargado.</h2>
        <p className="text-sm text-muted-foreground">
          {step.event.status === "pending" ? "Queda pendiente de revisión y en breve aparece en el mapa." : "Ya aparece en el mapa."}
        </p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/evento/${step.event.id}`}>Ver el evento</Link>
          </Button>
          <Button variant="outline" size="lg" onClick={reset}>
            Subir otro flyer
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "edit" || step.kind === "publishing") {
    const { result } = step;
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Flyer elegido" className="h-24 w-20 shrink-0 rounded-lg border object-cover" />
          )}
          <div className="space-y-1">
            <h2 className="font-semibold">Revisá lo que leímos</h2>
            <p className="text-sm text-muted-foreground">Corregí lo que haga falta y publicá.</p>
            <div className="flex gap-1.5">
              <Badge variant={result.mode === "live" ? "success" : "warning"}>{result.mode}</Badge>
              <Badge variant="secondary">confianza {Math.round(result.confidence * 100)}%</Badge>
            </div>
          </div>
        </div>

        {result.duplicates.length > 0 && (
          <section className="space-y-2 rounded-xl border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30">
            <h3 className="text-sm font-semibold">Posibles duplicados</h3>
            <p className="text-xs text-muted-foreground">Estos eventos se parecen. Si es el mismo, no hace falta publicarlo de nuevo.</p>
            {result.duplicates.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </section>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo publicar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DraftForm draft={result.draft} busy={step.kind === "publishing"} onSubmit={(raw) => publish(result, raw)} />
        <Button variant="ghost" className="w-full" onClick={reset} disabled={step.kind === "publishing"}>
          Cancelar
        </Button>
      </div>
    );
  }

  if (step.kind === "reading") {
    return (
      <div className="space-y-4" aria-busy aria-live="polite">
        <div className="flex items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-24 w-20 rounded-lg border object-cover" />
          )}
          <div>
            <p className="font-semibold">Leyendo el flyer…</p>
            <p className="text-sm text-muted-foreground">Claude está sacando título, fecha, lugar y precio.</p>
          </div>
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        id="flyer-file"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {!file ? (
        <label
          htmlFor="flyer-file"
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-muted/40 p-6 text-center transition-colors hover:bg-accent focus-within:ring-2 focus-within:ring-ring"
        >
          <span className="text-5xl" aria-hidden>📸</span>
          <span className="text-lg font-semibold">Subir flyer</span>
          <span className="text-sm text-muted-foreground">Sacale una foto o elegila de la galería</span>
        </label>
      ) : (
        <div className="space-y-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa del flyer" className="mx-auto max-h-80 w-auto rounded-2xl border object-contain" />
          )}
          <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
            Cambiar imagen
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="caption">
          Algo que sepas del evento <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id="caption" rows={2} maxLength={500} placeholder="Ej: es en el bar de Pichincha, entrada libre" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ups</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button size="lg" className="w-full" disabled={!file} onClick={read}>
        Leer el flyer
      </Button>
    </div>
  );
}
