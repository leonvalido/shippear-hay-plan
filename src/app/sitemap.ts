import type { MetadataRoute } from "next";
import { fetchEvents } from "@/app/_lib/api";
import { SITE_URL } from "@/components/landing/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await fetchEvents({ limit: "500" });
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/mapa`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/hoy`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    ...events.map((e) => {
      const d = new Date(e.createdAt);
      return { url: `${SITE_URL}/evento/${e.id}`, lastModified: Number.isNaN(d.getTime()) ? now : d, changeFrequency: "daily" as const, priority: 0.7 };
    }),
  ];
}
