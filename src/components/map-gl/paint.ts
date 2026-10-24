"use client";

import type { EventCategory } from "@/lib/events/schema";
import { CATEGORY_COLORS } from "@/components/events/format";
import { CATEGORY_ICON_PATHS } from "@/components/events/category-icon";

/**
 * MapLibre expressions take CSS colors but not oklch(). The brand palette is oklch, so the canvas converts it
 * (browsers gamut-map the same way they do for CSS); the table below is the fallback where canvas cannot.
 */
const FALLBACK: Record<string, string> = {
  musica: "#ad00a8",
  teatro: "#c50031",
  fiesta: "#7330d4",
  feria: "#ab5a00",
  deporte: "#008130",
  cultura: "#005dd1",
  gastronomia: "#ca3200",
  infantil: "#007c8c",
  charla: "#686800",
  otro: "#61626f",
};

/** Brand violet in dark mode (`--primary`), and its lifted hover/selected shade. */
export const VIOLET = "#bb3ad6";
export const VIOLET_LIGHT = "#d36dea";
export const VIOLET_SOURCE = "oklch(0.6 0.24 320)";
export const VIOLET_LIGHT_SOURCE = "oklch(0.7 0.2 320)";

const cache = new Map<string, string>();

/** Any CSS color → #rrggbb through a 1×1 canvas. */
export function toHex(css: string, fallback = "#888888"): string {
  const hit = cache.get(css);
  if (hit) return hit;
  let out = fallback;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      if (a > 0) out = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through */
  }
  cache.set(css, out);
  return out;
}

export function categoryHex(category: EventCategory): string {
  return toHex(CATEGORY_COLORS[category], FALLBACK[category]);
}

/** Two overlapping rounded squares: the pin icon for venues that mix categories. */
export const STACK_PATH = "M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 6V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1";

function svgIcon(path: string, size: number, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

/** Rasterizes an SVG string at `scale`× so the symbol layer can draw it crisp on hi-dpi screens. */
export function rasterize(svg: string, size: number, scale: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = Math.round(size * scale);
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(ctx.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => reject(new Error("icon"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export const ICON_SIZE = 13;
export const BADGE_SIZE = 17;

/** Every image the symbol layers reference: one white line icon per category, the stack icon and the count badge. */
export async function loadImages(map: { hasImage: (id: string) => boolean; addImage: (id: string, data: ImageData, opts: { pixelRatio: number }) => void }) {
  const scale = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
  const jobs: Promise<void>[] = [];
  const add = (id: string, svg: string, size: number) => {
    if (map.hasImage(id)) return;
    jobs.push(
      rasterize(svg, size, scale).then((data) => {
        if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: scale });
      }),
    );
  };
  for (const [cat, path] of Object.entries(CATEGORY_ICON_PATHS)) add(`icon-${cat}`, svgIcon(path, ICON_SIZE, "#fff"), ICON_SIZE);
  add("icon-stack", svgIcon(STACK_PATH, ICON_SIZE, "#fff"), ICON_SIZE);
  add(
    "badge",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BADGE_SIZE} ${BADGE_SIZE}" width="${BADGE_SIZE}" height="${BADGE_SIZE}"><circle cx="${BADGE_SIZE / 2}" cy="${BADGE_SIZE / 2}" r="${BADGE_SIZE / 2}" fill="#fff"/></svg>`,
    BADGE_SIZE,
  );
  await Promise.all(jobs);
}
