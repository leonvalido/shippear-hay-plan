"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StreamStatus } from "@/hooks/use-stream";
import { cn } from "@/lib/utils";

type Props = {
  status: StreamStatus;
  text: string;
  error?: string | null;
  mode?: "mock" | "live" | null;
  onRetry?: () => void;
  title?: string;
  emptyHint?: string;
  className?: string;
};

const MODE_BADGE = "px-2 py-0 text-xs font-normal text-muted-foreground";

/**
 * Reusable result panel: idle hint → skeleton → streaming text → done | error.
 * Drop it under any form; feed it the values from useStream().
 */
export function AIResult({ status, text, error, mode, onRetry, title = "Resultado", emptyHint, className }: Props) {
  return (
    <section className={cn("surface space-y-3 p-4", className)}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {mode === "mock" && <Badge variant="warning" className={MODE_BADGE}>mock</Badge>}
          {mode === "live" && <Badge variant="secondary" className={MODE_BADGE}>con IA en vivo</Badge>}
          {status === "streaming" && <Badge variant="secondary" className={MODE_BADGE}>generando…</Badge>}
        </div>
      </header>

      {status === "idle" && (
        <p className="text-base leading-[1.45] text-muted-foreground">
          {emptyHint ?? "Completá el formulario y apretá Generar."}
        </p>
      )}

      {status === "loading" && (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {status === "done" && !text.trim() && (
        <div>
          <p className="text-base font-semibold">No encontré nada para ese pedido.</p>
          <p className="text-base leading-[1.45] text-muted-foreground">Probá con otro día o con más presupuesto.</p>
        </div>
      )}

      {(status === "streaming" || (status === "done" && text.trim())) && (
        <div className="whitespace-pre-wrap break-words text-base leading-[1.45]">
          {text}
          {status === "streaming" && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground/70 align-text-bottom" />}
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="space-y-3">
          <div>
            <p className="text-base font-semibold">Se me trabó.</p>
            <p className="text-base leading-[1.45] text-muted-foreground">Mandá el mensaje de nuevo.</p>
            {error && <p className="mt-1 text-sm text-tertiary">{error}</p>}
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="h-11 rounded-full border-white/8 px-4">
              Mandar de nuevo
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
