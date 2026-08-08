import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/guards";
import { traerForm } from "@/lib/forms/registro";
import { VistaPreviaFormulario } from "@/components/panel/vista-previa-formulario";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const form = await traerForm(tipo);
  return { title: form ? `${form.title} · cómo se verá` : "Vista previa" };
}

export default async function VistaFormularioPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  await requireUser("ADMIN");
  const { tipo } = await params;

  const form = await traerForm(tipo);
  if (!form) notFound();

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <Link
        href={`/panel/formularios/${tipo}`}
        className="meta w-fit hover:text-[var(--color-ink)]"
      >
        ← Volver a editarlo
      </Link>

      <header className="grid gap-[var(--space-2xs)]">
        <h1 className="display text-(length:--text-xl)">Cómo se verá</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Una copia del formulario para mirarlo, no para usarlo: nada de lo que
          se escriba aquí se guarda ni se envía.
        </p>
      </header>

      <VistaPreviaFormulario form={form} />
    </div>
  );
}
