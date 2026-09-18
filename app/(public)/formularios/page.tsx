import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { TarjetasPostulacion } from "@/components/formularios/tarjetas-postulacion";

export const metadata: Metadata = { title: "Postular" };
export const dynamic = "force-dynamic";

export default function FormulariosPage() {
  return (
    <div className="shell grid gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Inicio
      </Link>

      <header className="grid max-w-[60ch] gap-[var(--space-sm)]">
        <h1 className="display text-(length:--text-display-s)">Postulaciones</h1>
        <p className="text-[var(--color-muted)]">
          Elige la que encaje contigo y postúlate.
        </p>
      </header>

      <TarjetasPostulacion />
    </div>
  );
}
