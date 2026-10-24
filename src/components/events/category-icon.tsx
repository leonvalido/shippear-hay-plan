import type { EventCategory } from "@/lib/events/schema";

/** Hand-drawn 24-grid line icons, one per category. Shared by React (chips, cards, detail) and the map (rasterized into MapLibre images). */
export const CATEGORY_ICON_PATHS: Record<EventCategory, string> = {
  // note
  musica: "M9 18V6l10-2v11M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm10-3a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  // theatre masks
  teatro: "M4 5h8v6a4 4 0 0 1-8 0zM6 8h.01M10 8h.01M6.5 10a1.8 1.8 0 0 0 3 0M12 9h8v6a4 4 0 0 1-8 0zM14 12h.01M18 12h.01M14.5 15.5a1.8 1.8 0 0 1 3 0",
  // sparkle / party
  fiesta: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM5 18l.6 1.4L7 20l-1.4.6L5 22l-.6-1.4L3 20l1.4-.6zM19 15l.6 1.4L21 17l-1.4.6L19 19l-.6-1.4L17 17l1.4-.6z",
  // market stall
  feria: "M3 9l1.5-4h15L21 9M3 9v2a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0V9M5 12v8h14v-8M10 20v-5h4v5",
  // ball
  deporte: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 10.5c3 1 5.5 3 7 6M12 3c-1 3-1 6 0 9s3.5 5 8 6M20.5 10.5c-3-1-5.5 0-8 3",
  // palette
  cultura: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h1.5a3.5 3.5 0 0 0 3.5-3.5A10 10 0 0 0 12 3zM7.5 12h.01M10 8h.01M14 8h.01M16.5 11h.01",
  // fork and knife
  gastronomia: "M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 3c-2 0-3 2.5-3 6v3h3v9M17 3v18",
  // balloon
  infantil: "M12 3a5.5 6.5 0 1 0 0 13 5.5 6.5 0 0 0 0-13zM12 16l-1 2h2zM12 18c-2 1-2 2.5 0 3s2 1.5 0 2",
  // mic
  charla: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  // star
  otro: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
};

export function CategoryIcon({ category, className, style }: { category: EventCategory; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={CATEGORY_ICON_PATHS[category]} />
    </svg>
  );
}

/** Two overlapping rounded squares: a venue with events of several categories. */
export const STACK_ICON_PATH = "M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 6V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1";
