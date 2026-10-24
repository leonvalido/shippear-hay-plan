"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

/**
 * Reusable result panel: idle hint → skeleton → streaming text → done | error.
 * Drop it under any form; feed it the values from useStream().
 */
export function AIResult({ status, text, error, mode, onRetry, title = "Resultado", emptyHint, className }: Props) {
  return (
    <Card className={cn("min-h-64", className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-2">
          {mode === "mock" && <Badge variant="warning">mock</Badge>}
          {mode === "live" && <Badge variant="secondary">con IA en vivo</Badge>}
          {status === "streaming" && <Badge variant="secondary">generando…</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
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

        {(status === "streaming" || status === "done") && (
          <div className="prose-sm whitespace-pre-wrap text-sm leading-relaxed">
            {text}
            {status === "streaming" && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground/70 align-text-bottom" />}
          </div>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Se me trabó</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            {onRetry && (
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={onRetry}>
                  Mandar de nuevo
                </Button>
              </div>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
