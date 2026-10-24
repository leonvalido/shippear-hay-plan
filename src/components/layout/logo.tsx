/** Inline mono logo (brand/logo-mono.svg): takes the current text color, so it works on dark and light. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 236 56" className={className} role="img" aria-label="HayPlan">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M28 4c-10.5 0-18 7.8-18 18 0 13 18 30 18 30s18-17 18-30c0-10.2-7.5-18-18-18zm0 8l2.6 6.8 6.8 2.6-6.8 2.6L28 30.8l-2.6-6.8-6.8-2.6 6.8-2.6z"
      />
      <text
        x="56"
        y="42"
        fontFamily="ui-rounded, 'SF Pro Rounded', 'Segoe UI', Inter, system-ui, sans-serif"
        fontSize="40"
        fontWeight="700"
        letterSpacing="-1"
        fill="currentColor"
      >
        hayplan
      </text>
    </svg>
  );
}
