import { CATEGORY_COLORS } from "@/components/events/format";

const PINS = [
  { x: 120, y: 110, c: CATEGORY_COLORS.musica, d: 0 },
  { x: 215, y: 150, c: CATEGORY_COLORS.fiesta, d: 0.6 },
  { x: 160, y: 205, c: CATEGORY_COLORS.feria, d: 1.2 },
  { x: 275, y: 95, c: CATEGORY_COLORS.teatro, d: 1.8 },
  { x: 80, y: 180, c: CATEGORY_COLORS.cultura, d: 2.4 },
  { x: 300, y: 215, c: CATEGORY_COLORS.gastronomia, d: 0.9 },
  { x: 235, y: 60, c: CATEGORY_COLORS.deporte, d: 1.5 },
];

/** Decorative, CSS-only: Rosario's grid, the river on the right and glowing pins behind the hero. */
export function HeroMap() {
  return (
    <svg
      viewBox="0 0 400 280"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      preserveAspectRatio="xMidYMid slice"
    >
      <g stroke="currentColor" strokeWidth="1" className="text-foreground/8" transform="rotate(-12 200 140)">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={-40 + i * 40} y1="-60" x2={-40 + i * 40} y2="360" />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`h${i}`} x1="-80" y1={-40 + i * 40} x2="480" y2={-40 + i * 40} />
        ))}
        <line x1="-80" y1="140" x2="480" y2="140" strokeWidth="3" className="text-foreground/12" />
        <line x1="200" y1="-60" x2="200" y2="360" strokeWidth="3" className="text-foreground/12" />
      </g>
      <path d="M345 -20 C 330 80, 370 160, 350 300 L 420 300 L 420 -20 Z" className="fill-primary/10" />
      {PINS.map((p, i) => (
        <g key={i} className="hero-pin" style={{ animationDelay: `${p.d}s`, transformOrigin: `${p.x}px ${p.y}px` }}>
          <circle cx={p.x} cy={p.y} r="18" fill={p.c} opacity="0.2" className="hero-glow" style={{ animationDelay: `${p.d}s`, transformOrigin: `${p.x}px ${p.y}px` }} />
          <circle cx={p.x} cy={p.y} r="6" fill={p.c} stroke="#fff" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
