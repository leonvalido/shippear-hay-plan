import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { NavLinks } from "@/components/layout/nav-links";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HayPlan · Qué hacer en Rosario", template: "%s · HayPlan" },
  description: "Todo lo que pasa en Rosario, en un mapa. Eventos de fuentes públicas, redes y flyers, con recomendaciones.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <nav aria-label="Principal" className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
            <Link href="/" className="flex items-center gap-1.5 font-bold tracking-tight">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-primary" />
              HayPlan
            </Link>
            <NavLinks />
          </nav>
        </header>
        <main className="flex min-h-0 w-full flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
