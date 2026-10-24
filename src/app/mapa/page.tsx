import type { Metadata } from "next";
import { fetchEvents } from "@/app/_lib/api";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = { title: "Mapa" };
export const dynamic = "force-dynamic";

const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4";

export default async function MapaPage() {
  // First paint comes with the default list (next 14 days) already in the HTML; the client only refetches on filter changes.
  const initialEvents = await fetchEvents();
  return (
    <>
      <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
      <link rel="preconnect" href="https://a.tile.openstreetmap.org" crossOrigin="" />
      <link rel="preload" as="style" href={`${LEAFLET}/leaflet.min.css`} crossOrigin="" />
      <link rel="preload" as="script" href={`${LEAFLET}/leaflet.min.js`} crossOrigin="" />
      <h1 className="sr-only">Mapa de eventos en Rosario</h1>
      <MapExplorer initialEvents={initialEvents} />
    </>
  );
}
