import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
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
      <Link href={`/panel/formularios/${tipo}`} className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Volver a editarlo
      </Link>

      <h1 className="display text-(length:--text-xl)">Cómo se verá</h1>

      <VistaPreviaFormulario form={form} />
    </div>
  );
}
