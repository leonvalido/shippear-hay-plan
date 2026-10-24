"use client";

import { usePathname } from "next/navigation";

/** Site footer; hidden on the map, which owns the whole viewport. */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/mapa")) return null;
  return (
    <footer className="border-t border-white/8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-1 px-4 py-5 text-[13px] text-tertiary sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Hecho en Rosario en Shippear #3 · Datos de fuentes públicas y redes</p>
        <span className="flex items-center gap-4">
          <a href="/video/hayplan.mp4" className="hover:text-foreground">
            Ver el video
          </a>
          <a href="mailto:hola@hayplan.app?subject=HayPlan" className="hover:text-foreground">
            Contacto
          </a>
        </span>
      </div>
    </footer>
  );
}
