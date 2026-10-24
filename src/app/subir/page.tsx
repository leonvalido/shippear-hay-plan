import type { Metadata } from "next";
import { FlyerUpload } from "@/components/flyer/flyer-upload";

export const metadata: Metadata = { title: "Subir flyer" };

export default function SubirPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Subí un flyer</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Una foto alcanza: leemos el flyer y lo subimos al mapa.</p>
      <FlyerUpload />
    </div>
  );
}
