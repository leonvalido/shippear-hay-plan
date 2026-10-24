"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, CATEGORY_LABELS, TZ } from "@/components/events/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventCategory, RawEvent } from "@/lib/events/schema";

type Props = {
  draft: RawEvent;
  busy?: boolean;
  onSubmit: (event: RawEvent) => void;
};

type Fields = {
  title: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  venueName: string;
  address: string;
  category: EventCategory;
  free: boolean;
  price: string;
  description: string;
};

/** Split an ISO date into the local (Rosario) date and time inputs. */
function splitIso(iso: string | undefined): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour").replace("24", "00")}:${get("minute")}` };
}

function toIso(date: string, time: string): string {
  return `${date}T${time || "21:00"}:00-03:00`;
}

/** Editable form prefilled with what Claude read from the flyer. */
export function DraftForm({ draft, busy, onSubmit }: Props) {
  const { date, time } = splitIso(draft.startsAt);
  const [f, setF] = useState<Fields>({
    title: draft.title ?? "",
    date,
    time,
    venueName: draft.venueName ?? "",
    address: draft.address ?? "",
    category: draft.category ?? "otro",
    free: draft.price?.free ?? false,
    price: draft.price?.min != null ? String(draft.price.min) : "",
    description: draft.description ?? "",
  });
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((prev) => ({ ...prev, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const price = f.free ? { free: true, currency: "ARS" as const } : f.price.trim()
      ? { free: false, min: Number(f.price), currency: "ARS" as const }
      : undefined;
    onSubmit({
      ...draft,
      title: f.title.trim(),
      startsAt: toIso(f.date, f.time),
      venueName: f.venueName.trim(),
      address: f.address.trim() || undefined,
      category: f.category,
      price,
      description: f.description.trim() || undefined,
      sourceType: draft.sourceType ?? "flyer",
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Título" id="title">
        <Input id="title" required minLength={2} maxLength={160} value={f.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" id="date">
          <Input id="date" type="date" required value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Hora" id="time">
          <Input id="time" type="time" required value={f.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
      </div>
      <Field label="Lugar" id="venue">
        <Input id="venue" required value={f.venueName} onChange={(e) => set("venueName", e.target.value)} />
      </Field>
      <Field label="Dirección" id="address" hint="opcional">
        <Input id="address" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Calle y altura, Rosario" />
      </Field>
      <Field label="Categoría" id="category">
        <select
          id="category"
          value={f.category}
          onChange={(e) => set("category", e.target.value as EventCategory)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 items-end gap-3">
        <label className="flex h-9 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={f.free} onChange={(e) => set("free", e.target.checked)} className="size-4 accent-primary" />
          Es gratis
        </label>
        <Field label="Precio (ARS)" id="price">
          <Input id="price" type="number" min={0} step={100} inputMode="numeric" disabled={f.free} value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="Ej: 15000" />
        </Field>
      </div>
      <Field label="Descripción" id="description" hint="opcional">
        <textarea
          id="description"
          rows={3}
          maxLength={2000}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Publicando…" : "Publicar"}
      </Button>
    </form>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}
