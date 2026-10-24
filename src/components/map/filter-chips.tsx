"use client";

import { cn } from "@/lib/utils";

type Chip<T extends string> = { value: T; label: string; color?: string };

type Props<T extends string> = {
  label: string;
  chips: Chip<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
};

/** Horizontal, scrollable row of toggle chips. Tapping the active chip clears it. */
export function FilterChips<T extends string>({ label, chips, value, onChange }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {chips.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : c.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
            )}
          >
            {c.color && <span aria-hidden className="size-2 rounded-full" style={{ background: c.color }} />}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
