import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { MOCK_ANSWER, SYSTEM_PROMPT } from "./prompts";

/**
 * Thin wrapper around the Anthropic SDK with a mock fallback.
 *
 *  - streamText(): text streamed token by token (for the UI)
 *  - completeJSON(): one shot, schema-validated object (for structured results)
 *
 * Mock mode kicks in when ANTHROPIC_API_KEY is missing or MOCK_AI=1, so the
 * app always runs. Never import this file from a client component.
 */

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT || "low") as "low" | "medium" | "high";

export function isMockMode() {
  return !process.env.ANTHROPIC_API_KEY || process.env.MOCK_AI === "1";
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

export type StreamOptions = {
  prompt: string;
  system?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Text streamed in mock mode instead of the generic MOCK_ANSWER. */
  mock?: string;
};

/** Base64 image for vision requests. */
export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

/** Returns a byte stream of UTF-8 text deltas. Pipe it straight into a Response. */
export function streamText(opts: StreamOptions): ReadableStream<Uint8Array> {
  if (isMockMode()) return mockStream(opts.mock ?? MOCK_ANSWER);

  const encoder = new TextEncoder();
  const stream = getClient().messages.stream(
    {
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system ?? SYSTEM_PROMPT,
      output_config: { effort: EFFORT },
      messages: [{ role: "user", content: opts.prompt }],
    },
    { signal: opts.signal },
  );

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      stream
        .finalMessage()
        .then((msg) => {
          if (msg.stop_reason === "refusal") {
            controller.enqueue(encoder.encode("\n\n_(El modelo declinó responder este pedido.)_"));
          }
          controller.close();
        })
        .catch((err: unknown) => controller.error(err));
    },
    cancel() {
      stream.abort();
    },
  });
}

/**
 * One-shot structured output validated against a Zod schema.
 * In mock mode `mock` is returned (pass a realistic sample for your UI).
 */
export async function completeJSON<T extends z.ZodType>(opts: {
  prompt: string;
  schema: T;
  mock: z.infer<T>;
  system?: string;
  maxTokens?: number;
  /** Optional image sent before the prompt. */
  image?: ImageInput;
}): Promise<z.infer<T>> {
  if (isMockMode()) {
    await sleep(600);
    return opts.mock;
  }
  const content: Anthropic.ContentBlockParam[] = opts.image
    ? [
        { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } },
        { type: "text", text: opts.prompt },
      ]
    : [{ type: "text", text: opts.prompt }];
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system ?? SYSTEM_PROMPT,
    output_config: { effort: EFFORT, format: zodOutputFormat(opts.schema) },
    messages: [{ role: "user", content }],
  });
  if (!response.parsed_output) {
    throw new Error(`El modelo no devolvió un objeto válido (stop_reason=${response.stop_reason}).`);
  }
  return response.parsed_output;
}

/** Turn an API error into a short message safe to show in the UI. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "API key inválida. Revisá ANTHROPIC_API_KEY en .env.local.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limit alcanzado. Esperá unos segundos y reintentá.";
  if (err instanceof Anthropic.APIConnectionError) return "Sin conexión con la API. ¿WiFi? Podés activar MOCK_AI=1.";
  if (err instanceof Anthropic.APIError) return `Error de la API (${err.status}): ${err.message}`;
  if (err instanceof Error) return err.message;
  return "Error desconocido.";
}

// ---------- mock helpers ----------

function mockStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(/(?<=\s)/); // keep whitespace attached
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= words.length) return controller.close();
      controller.enqueue(encoder.encode(words[i++]));
      await sleep(18 + Math.random() * 30);
    },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
