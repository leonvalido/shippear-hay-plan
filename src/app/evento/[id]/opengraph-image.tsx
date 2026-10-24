import { ImageResponse } from "next/og";
import { fetchEvent } from "@/app/_lib/api";
import { CATEGORY_COLORS, CATEGORY_LABELS, displayTitle, formatPrice, formatWhen, humanizeTitle } from "@/components/events/format";

export const alt = "Evento en HayPlan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Per-event card: short title, day · time, venue, price. Shown when the link is shared on WhatsApp. */
export default async function EventOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await fetchEvent(id);
  const color = event ? CATEGORY_COLORS[event.category] : "#aa24c5";
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
          background: `linear-gradient(135deg, #15111a 0%, #221a2c 55%, ${color} 160%)`,
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            <svg width="40" height="40" viewBox="0 0 56 56">
              <path fill="#da74f1" d="M28 4c-10.5 0-18 7.8-18 18 0 13 18 30 18 30s18-17 18-30c0-10.2-7.5-18-18-18z" />
              <path fill="#fff" d="M28 12l2.6 6.8 6.8 2.6-6.8 2.6L28 30.8l-2.6-6.8-6.8-2.6 6.8-2.6z" />
            </svg>
            hayplan
          </div>
          {event && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 26, padding: "10px 22px", borderRadius: 999, background: color }}>
              {CATEGORY_LABELS[event.category]}
            </div>
          )}
        </div>
        {event ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>{formatWhen(event)}</div>
            <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 1050 }}>{displayTitle(event)}</div>
            <div style={{ fontSize: 34, color: "rgba(255,255,255,0.75)" }}>{humanizeTitle(event.venueName)}</div>
          </div>
        ) : (
          <div style={{ fontSize: 72, fontWeight: 800 }}>Mirá qué pasa hoy en Rosario.</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
          {event && (
            <div style={{ padding: "8px 20px", borderRadius: 999, background: event.price?.free ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.12)", color: event.price?.free ? "#6ee7b7" : "#fff" }}>
              {formatPrice(event.price)}
            </div>
          )}
          <div style={{ color: "rgba(255,255,255,0.6)" }}>hayplan · Rosario</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
