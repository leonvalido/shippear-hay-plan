"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/mapa", label: "Mapa" },
  { href: "/hoy", label: "Qué hago hoy" },
] as const;

/** Top navigation; highlights the active section. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex shrink-0 items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center whitespace-nowrap rounded-md px-3 transition-colors hover:bg-accent",
                "after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
                active ? "font-medium text-foreground after:opacity-100" : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
