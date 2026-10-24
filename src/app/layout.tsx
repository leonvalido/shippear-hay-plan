import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Open_Sans } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "800"], variable: "--font-open-sans", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://shippear-starter.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "HayPlan · Qué hacer en Rosario", template: "%s · HayPlan" },
  openGraph: { type: "website", siteName: "HayPlan", locale: "es_AR" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  description: "El mapa de lo que pasa hoy en Rosario, con un chat que te dice qué hacer.",
  applicationName: "HayPlan",
  appleWebApp: { capable: true, title: "HayPlan", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1520",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${openSans.variable}`}>
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
          <nav aria-label="Principal" className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-2 px-4 sm:px-6">
            <Link href="/" aria-label="HayPlan, inicio" className="flex h-11 min-w-0 items-center text-foreground">
              <Logo className="h-7 w-auto" />
            </Link>
            <Suspense fallback={<span className="h-10" aria-hidden />}>
              <NavLinks />
            </Suspense>
          </nav>
        </header>
        <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
