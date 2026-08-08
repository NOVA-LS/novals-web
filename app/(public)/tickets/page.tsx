import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/guards";
import { getCategoriaTicket } from "@/lib/tickets/categorias";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { entrarConDiscord } from "@/lib/actions/auth";
import { hace } from "@/lib/utils";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { EstadoTicket } from "@/components/tickets/estado-ticket";
import { Paginacion } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Mis tickets" };
export const dynamic = "force-dynamic";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const usuario = await currentUser();
  const { p } = await searchParams;

  if (!usuario) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">Tickets</h1>
        <p className="text-[var(--color-muted)]">
          Entra con Discord para abrir un ticket o seguir los que tengas.
        </p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value="/tickets" />
          <Boton variante="primary" type="submit">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  // Los suyos son los que abrió y también aquellos en los que le metieron.
  const where = {
    OR: [
      { authorId: usuario.id },
      { invitados: { some: { userId: usuario.id } } },
    ],
  };

  const total = await db.ticket.count({ where });
  const pagina = paginar(total, POR_PAGINA.tickets, leerPagina(p));

  const tickets = await db.ticket.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    skip: pagina.salta,
    take: pagina.toma,
    select: {
      id: true,
      numero: true,
      subject: true,
      category: true,
      status: true,
      lastMessageAt: true,
      authorId: true,
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="shell grid max-w-[62rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Inicio
      </Link>

      <div className="section-head section-head--fila">
        <div className="grid gap-[var(--space-2xs)]">
          <h1 className="display text-(length:--text-display-s)">Mis tickets</h1>
          <p className="text-[var(--color-muted)]">
            Reportes, dudas y donaciones. Solo los ve el staff que los atiende.
          </p>
        </div>
        <EnlaceBoton href="/tickets/nuevo" variante="primary">
          <Plus size={15} aria-hidden />
          Abrir uno
        </EnlaceBoton>
      </div>

      {tickets.length === 0 ? (
        <div className="tile grid justify-items-start gap-[var(--space-sm)]">
          <p className="text-[var(--color-muted)]">
            No has abierto ninguno todavía.
          </p>
          <EnlaceBoton href="/tickets/nuevo">Abrir el primero</EnlaceBoton>
        </div>
      ) : (
        <ul className="grid gap-[var(--space-xs)]">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}`}
                className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
              >
                <span className="flex flex-wrap items-center gap-[var(--space-sm)]">
                  <span className="meta">#{ticket.numero}</span>
                  <span className="min-w-0 flex-1 truncate">{ticket.subject}</span>
                  <EstadoTicket status={ticket.status} vista="jugador" />
                </span>
                <span className="meta">
                  {getCategoriaTicket(ticket.category)?.nombre ?? ticket.category} ·{" "}
                  {ticket._count.messages} mensaje(s) · {hace(ticket.lastMessageAt)}
                  {ticket.authorId === usuario.id ? "" : " · te metieron en él"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        href={(numero) => `/tickets?p=${numero}`}
        etiqueta="Páginas de tickets"
      />
    </div>
  );
}
