import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { currentUser } from "@/lib/guards";
import { CATEGORIAS_TICKET, getCategoriaTicket } from "@/lib/tickets/categorias";
import { entrarConDiscord } from "@/lib/actions/auth";
import { Boton } from "@/components/ui/button";
import { FormularioTicket } from "@/components/tickets/formulario-ticket";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return CATEGORIAS_TICKET.map((categoria) => ({ categoria: categoria.clave }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  return { title: getCategoriaTicket(categoria)?.nombre ?? "Ticket" };
}

export default async function NuevoTicketDeCategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria: clave } = await params;
  const categoria = getCategoriaTicket(clave);
  if (!categoria) notFound();

  const usuario = await currentUser();

  if (!usuario) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">{categoria.nombre}</h1>
        <p className="text-[var(--color-muted)]">
          Entra con Discord para abrirlo.
        </p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value={`/tickets/nuevo/${clave}`} />
          <Boton variante="primary" type="submit">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  return (
    <div className="shell grid max-w-[46rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/tickets/nuevo" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Categorías
      </Link>

      <div className="grid gap-[var(--space-2xs)]">
        <h1 className="display text-(length:--text-display-s)">{categoria.nombre}</h1>
        <p className="text-[var(--color-muted)]">{categoria.descripcion}</p>
      </div>

      {categoria.aviso ? (
        <p className="nota-staff flex items-start gap-[var(--space-xs)] text-sm">
          <Info size={15} className="mt-[0.15rem] shrink-0" aria-hidden />
          {categoria.aviso}
        </p>
      ) : null}

      <FormularioTicket categoria={categoria} />
    </div>
  );
}
