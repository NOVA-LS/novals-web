import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { actorActual } from "@/lib/foro/actor";
import { CATEGORIAS, getCategoria } from "@/lib/foro/categorias";
import { puedePublicar } from "@/lib/foro/reglas";
import { EditorHilo } from "@/components/foro/editor-hilo";
import { EnlaceBoton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nuevo hilo" };
export const dynamic = "force-dynamic";

export default async function NuevoHiloPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const [{ categoria }, actor] = await Promise.all([searchParams, actorActual()]);

  if (!puedePublicar(actor)) {
    return (
      <div className="shell grid max-w-[46rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-xl)">Todavía no</h1>
        <p className="text-[var(--color-muted)]">
          El foro se escribe con la whitelist aceptada. Puedes leerlo entero
          mientras tanto.
        </p>
        <div className="flex flex-wrap gap-[var(--space-xs)]">
          <EnlaceBoton href="/formularios/whitelist" variante="primary" className="btn--redondo">
            Rellenar whitelist
          </EnlaceBoton>
          <EnlaceBoton href="/foro" className="btn--redondo">
            Volver al foro
          </EnlaceBoton>
        </div>
      </div>
    );
  }

  const inicial = getCategoria(categoria ?? "")?.slug ?? CATEGORIAS[0].slug;

  return (
    <div className="shell grid max-w-[52rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/foro" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Foro
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        <h1 className="display text-(length:--text-xl)">Abrir hilo</h1>
        <p className="text-[var(--color-muted)]">
          Un título que se entienda solo y el cuerpo en Markdown.
        </p>
      </header>

      <EditorHilo categoriaInicial={inicial} />
    </div>
  );
}
