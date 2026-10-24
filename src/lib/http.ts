/** Small helpers shared by the API routes: JSON errors with status + one-line failure logs (never the payload). */

export function jsonError(route: string, status: number, message: string, detail?: unknown): Response {
  const extra = detail instanceof Error ? detail.message : typeof detail === "string" ? detail : "";
  console.error(`[${route}] ${status} ${message}${extra ? ` · ${extra.slice(0, 200)}` : ""}`);
  return Response.json({ error: message }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
