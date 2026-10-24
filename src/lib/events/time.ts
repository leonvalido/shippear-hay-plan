/** Rosario is UTC-03:00 all year (Argentina has no DST). */
export const ROSARIO_OFFSET = "-03:00";
const OFFSET_MS = -3 * 60 * 60 * 1000;

/** Format a Date as ISO 8601 with the -03:00 offset, e.g. "2026-10-25T21:00:00-03:00". */
export function toRosarioISO(d: Date): string {
  const local = new Date(d.getTime() + OFFSET_MS);
  return local.toISOString().slice(0, 19) + ROSARIO_OFFSET;
}

/** Calendar date (YYYY-MM-DD) in Rosario for a given instant. */
export function rosarioDate(d: Date = new Date()): string {
  return toRosarioISO(d).slice(0, 10);
}

/**
 * Parse a user supplied date/time. Accepts full ISO (any offset), "YYYY-MM-DD"
 * (interpreted as midnight in Rosario) or "YYYY-MM-DDTHH:mm" without offset.
 * Returns undefined when unparsable.
 */
export function parseInstant(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00${ROSARIO_OFFSET}`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(t)) return new Date(`${t}${ROSARIO_OFFSET}`);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function epochMs(iso: string): number {
  const d = parseInstant(iso);
  return d ? d.getTime() : Number.NaN;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Start of a Rosario calendar day for a given instant. */
export function startOfRosarioDay(d: Date): Date {
  return new Date(`${rosarioDate(d)}T00:00:00${ROSARIO_OFFSET}`);
}

/** "YYYY-MM-DDT00:00:00..." or a bare date: the source gave no time of day. */
export function isMidnight(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T00:00(:00)?)?([+-]\d{2}:\d{2}|Z)?$/.test(iso.trim());
}
