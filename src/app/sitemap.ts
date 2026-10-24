import type { MetadataRoute } from "next";
import { fetchEvents } from "@/app/_lib/api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await fetchEvents({ limit: "500" });
  const now = new Date();
  return [
    { url: "/", lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: "/mapa", lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: "/hoy", lastModified: now, changeFrequency: "daily", priority: 0.5 },
    ...events.map((e) => ({ url: `/evento/${e.id}`, lastModified: new Date(e.createdAt), changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
