import { ImageResponse } from "next/og";
import { fetchEvents } from "@/app/_lib/api";
import { dayRange } from "@/components/events/format";

export const alt = "HayPlan · Mirá qué pasa hoy en Rosario";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Site-wide Open Graph card: logo, headline, live event count. */
export default async function OgImage() {
  const week = await fetchEvents({ ...dayRange("semana"), limit: "500" } as Record<string, string>);
  const count = week.length;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #15111a 0%, #221a2c 60%, #2a1838 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="44" height="44" viewBox="0 0 56 56">
            <path fill="#da74f1" d="M28 4c-10.5 0-18 7.8-18 18 0 13 18 30 18 30s18-17 18-30c0-10.2-7.5-18-18-18z" />
            <path fill="#fff" d="M28 12l2.6 6.8 6.8 2.6-6.8 2.6L28 30.8l-2.6-6.8-6.8-2.6 6.8-2.6z" />
          </svg>
          <div style={{ display: "flex",  fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>hayplan</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex",  fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, maxWidth: 1000 }}>Mirá qué pasa hoy en Rosario.</div>
          <div style={{ display: "flex",  fontSize: 32, color: "rgba(255,255,255,0.7)" }}>El mapa de lo que pasa hoy, con un concierge que te arma el plan.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
          <div style={{ display: "flex",  width: 16, height: 16, borderRadius: 999, background: "#34d399" }} />
          <div style={{ display: "flex",  fontWeight: 700 }}>{count}</div>
          <div style={{ display: "flex",  color: "rgba(255,255,255,0.7)" }}>eventos esta semana</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
