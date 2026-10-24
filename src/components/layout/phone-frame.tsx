"use client";

import { useEffect, useState } from "react";

/** A CSS phone frame showing the live product. The iframe only mounts on wide screens, so phones never load it. */
export function PhoneFrame({ src, className }: { src: string; className?: string }) {
  const [mount, setMount] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setMount(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div
      className={className}
      aria-label="HayPlan en un teléfono"
      style={{
        width: 300,
        height: 620,
        borderRadius: 44,
        padding: 10,
        background: "linear-gradient(160deg, #2a2233, #120e17)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.12)",
      }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-background">
        <div aria-hidden className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black/80" />
        {mount ? (
          // A real 390x844 phone viewport, scaled to the frame: the app renders at its true size.
          <iframe
            src={src}
            title="Mapa de HayPlan"
            width={390}
            height={844}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
            className="pointer-events-none border-0"
            style={{ width: 390, height: 844, transform: `scale(${280 / 390})`, transformOrigin: "top left" }}
          />
        ) : (
          <div className="skeleton-shimmer h-full w-full" />
        )}
      </div>
    </div>
  );
}
