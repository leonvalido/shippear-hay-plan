import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
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
        <SiteHeader />
        <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
