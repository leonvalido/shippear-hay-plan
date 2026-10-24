import type { Metadata } from "next";
import { fetchEvents } from "@/app/_lib/api";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = {
  title: "Mapa",
  description: "Todos los eventos de hoy en Rosario, en un mapa.",
  alternates: { canonical: "/mapa" },
  openGraph: { title: "El mapa de hoy en Rosario · HayPlan", description: "Todos los eventos de hoy en Rosario, en un mapa." },
};
export const dynamic = "force-dynamic";

const MAPLIBRE = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1";

export default async function MapaPage() {
  // First paint comes with the default list (next 14 days) already in the HTML; the client only refetches on filter changes.
  const initialEvents = await fetchEvents();
  return (
    <>
      <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
      <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="" />
      <link rel="preconnect" href="https://tiles.basemaps.cartocdn.com" crossOrigin="" />
      <link rel="preload" as="style" href={`${MAPLIBRE}/maplibre-gl.min.css`} crossOrigin="" />
      <link rel="preload" as="script" href={`${MAPLIBRE}/maplibre-gl.min.js`} crossOrigin="" />
      <link rel="preload" as="fetch" href="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" crossOrigin="" />
      <h1 className="sr-only">Mapa de eventos en Rosario</h1>
      <MapExplorer initialEvents={initialEvents} />
    </>
  );
}
