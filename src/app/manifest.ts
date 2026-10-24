import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HayPlan",
    short_name: "HayPlan",
    description: "El mapa de lo que pasa hoy en Rosario, con un concierge que te arma el plan.",
    start_url: "/mapa",
    display: "standalone",
    background_color: "#1a1520",
    theme_color: "#1a1520",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
