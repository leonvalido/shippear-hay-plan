import { NextRequest } from "next/server";
import { z } from "zod";
import type { ImageInput } from "@/lib/ai";
import { describeError } from "@/lib/ai";
import { MAX_IMAGE_BYTES, base64Bytes, isImageType, readFlyer, splitDataUrl } from "@/lib/events/flyer";
import { geocodeAddress } from "@/lib/events/geocode";
import { getEventStore } from "@/lib/events/store";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/flyer
 *   multipart/form-data: image (jpeg/png/webp/gif <= 5 MB), caption?
 *   or JSON: { imageBase64, mediaType, caption? }
 * -> { draft: RawEvent, confidence, duplicates: Event[], mode }
 */
const JsonBody = z.object({
  imageBase64: z.string().min(16),
  mediaType: z.string().optional(),
  caption: z.string().max(2000).optional(),
});

type Parsed = { image: ImageInput; caption?: string } | { error: string; status: number };

async function parseMultipart(req: NextRequest): Promise<Parsed> {
  const form = await req.formData().catch(() => undefined);
  const file = form?.get("image");
  if (!form || !(file instanceof File)) return { error: "Falta el campo image", status: 400 };
  if (file.size > MAX_IMAGE_BYTES) return { error: "La imagen supera 5 MB", status: 413 };
  const type = file.type || "image/jpeg";
  if (!isImageType(type)) return { error: `Formato no soportado: ${type}`, status: 415 };
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const caption = form.get("caption");
  return { image: { mediaType: type, data }, caption: typeof caption === "string" ? caption.slice(0, 2000) : undefined };
}

async function parseJsonBody(req: NextRequest): Promise<Parsed> {
  const parsed = JsonBody.safeParse(await readJson(req));
  if (!parsed.success) return { error: "Body inválido: se espera { imageBase64, mediaType, caption? }", status: 400 };
  const { data, mediaType: fromUrl } = splitDataUrl(parsed.data.imageBase64);
  const type = parsed.data.mediaType ?? fromUrl ?? "image/jpeg";
  if (!isImageType(type)) return { error: `Formato no soportado: ${type}`, status: 415 };
  if (base64Bytes(data) > MAX_IMAGE_BYTES) return { error: "La imagen supera 5 MB", status: 413 };
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) return { error: "imageBase64 no es base64 válido", status: 400 };
  return { image: { mediaType: type, data }, caption: parsed.data.caption };
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  const input = ct.includes("multipart/form-data") ? await parseMultipart(req) : await parseJsonBody(req);
  if ("error" in input) return jsonError("flyer", input.status, input.error);

  try {
    const { draft, confidence, mode } = await readFlyer(input.image, input.caption);
    if (draft.lat === undefined && draft.address) {
      const p = await geocodeAddress(draft.address).catch(() => undefined);
      if (p) Object.assign(draft, p);
    }
    const duplicates = (await getEventStore()).findDuplicates(draft);
    return Response.json({ draft, confidence, duplicates, mode });
  } catch (err) {
    return jsonError("flyer", 502, describeError(err), err);
  }
}
