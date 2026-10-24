import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = { title: "Mapa" };

export default function MapaPage() {
  return (
    <>
      <h1 className="sr-only">Mapa de eventos en Rosario</h1>
      <MapExplorer />
    </>
  );
}
