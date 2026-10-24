"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

/** Logo-only header. The map owns its viewport and shows a floating badge instead. */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/mapa")) return null;
  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center px-4 sm:px-6">
        <Link href="/" aria-label="HayPlan, inicio" className="flex h-11 items-center text-foreground">
          <Logo className="h-7 w-auto" />
        </Link>
      </div>
    </header>
  );
}
