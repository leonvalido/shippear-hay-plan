"use client";

import { cn } from "@/lib/utils";

type Chip<T extends string> = { value: T; label: string; color?: string; icon?: React.ReactNode };

type Props<T extends string> = {
  label: string;
  chips: Chip<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
};

/** Horizontal, scrollable row of toggle chips. Tapping the active chip clears it. */
export function FilterChips<T extends string>({ label, chips, value, onChange }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-1.5">
      {chips.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : c.value)}
            className={cn(
              "tap flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium",
              active ? "border-primary bg-primary text-white" : "border-white/8 bg-card text-foreground hover:bg-accent",
            )}
          >
            {c.icon ? (
              <span className={cn("flex size-3.5 items-center justify-center", !active && "[&>svg]:text-[var(--chip-color)]")} style={{ "--chip-color": c.color } as React.CSSProperties}>
                {c.icon}
              </span>
            ) : (
              c.color && <span aria-hidden className="size-2 rounded-full" style={{ background: c.color }} />
            )}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
