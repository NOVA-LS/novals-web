import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/guards";
import { CATEGORIAS_TICKET } from "@/lib/tickets/categorias";
import { entrarConDiscord } from "@/lib/actions/auth";
import { Boton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Abrir un ticket" };
export const dynamic = "force-dynamic";

export default async function NuevoTicketPage() {
  const usuario = await currentUser();

  if (!usuario) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">Abrir un ticket</h1>
        <p className="text-[var(--color-muted)]">
          Hace falta entrar con Discord: sin saber quién eres no podemos
          contestarte.
        </p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value="/tickets/nuevo" />
          <Boton variante="primary" type="submit">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  return (
    <div className="shell grid max-w-[52rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/tickets" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Mis tickets
      </Link>

      <div className="grid gap-[var(--space-2xs)]">
        <h1 className="display text-(length:--text-display-s)">¿De qué va?</h1>
        <p className="text-[var(--color-muted)]">
          Elegir bien la categoría es lo que hace que lo lea quien puede
          resolverlo.
        </p>
      </div>

      <ul className="grid gap-[var(--space-xs)]">
        {CATEGORIAS_TICKET.map((categoria) => (
          <li key={categoria.clave}>
            <Link
              href={`/tickets/nuevo/${categoria.clave}`}
              className="tile tile--link flex items-center justify-between gap-[var(--space-md)]"
            >
              <span className="grid gap-[var(--space-2xs)]">
                <span className="display text-(length:--text-md)">
                  {categoria.nombre}
                </span>
                <span className="text-sm text-[var(--color-muted)]">
                  {categoria.descripcion}
                </span>
              </span>
              <ArrowRight size={18} className="shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
