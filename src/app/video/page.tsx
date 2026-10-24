import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const DESCRIPTION = "El mapa de lo que pasa hoy en Rosario, con un chat que te dice qué hacer. Demo de HayPlan para Shippear #3.";

export const metadata: Metadata = {
  title: "Video",
  description: DESCRIPTION,
  alternates: { canonical: "/video" },
  openGraph: {
    type: "video.other",
    title: "HayPlan · Video",
    description: DESCRIPTION,
    url: "/video",
    images: [{ url: "/video/poster.jpg", width: 1920, height: 1080, alt: "HayPlan, el mapa de lo que pasa hoy en Rosario" }],
    videos: [{ url: "/video/hayplan.mp4", type: "video/mp4", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HayPlan · Video",
    description: DESCRIPTION,
    images: ["/video/poster.jpg"],
  },
};

export default function VideoPage() {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
      <Logo className="h-10 w-auto text-foreground" />
      <video
        controls
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster="/video/poster.jpg"
        src="/video/hayplan.mp4"
        className="aspect-video w-full rounded-2xl bg-black shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
      />
      <p className="text-center text-[15px] text-tertiary">HayPlan · Shippear #3 · Rosario</p>
      <Link
        href="/mapa"
        className="rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-primary-foreground hover:opacity-90"
      >
        Abrir el mapa
      </Link>
    </div>
  );
}
