"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { EventMap as LeafletMap } from "@/components/map/event-map";
import { EventMapGL } from "./event-map-gl";

/** Feature flag: `/mapa?gl=1` renders the MapLibre map, anything else the Leaflet one. Same props on both. */
export function EventMap(props: ComponentProps<typeof LeafletMap>) {
  const params = useSearchParams();
  const gl = params.get("gl");
  return gl === "1" ? <EventMapGL {...props} /> : <LeafletMap {...props} />;
}
