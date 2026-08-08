import Link from "next/link";
import type { Metadata } from "next";
import { TarjetasPostulacion } from "@/components/formularios/tarjetas-postulacion";

export const metadata: Metadata = { title: "Postular" };
export const dynamic = "force-dynamic";

export default function FormulariosPage() {
  return (
    <div className="shell grid gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Inicio
      </Link>

      <header className="grid max-w-[60ch] gap-[var(--space-sm)]">
        <h1 className="display text-(length:--text-display-s)">Postulaciones</h1>
        <p className="text-[var(--color-muted)]">
          Necesitas iniciar sesión con Discord para enviar cualquiera de estos
          formularios. Se revisan a mano, uno por uno.
        </p>
      </header>

      <TarjetasPostulacion />
    </div>
  );
}
