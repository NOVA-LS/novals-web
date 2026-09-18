import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Bell, BellOff } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/guards";
import { entrarConDiscord } from "@/lib/actions/auth";
import { actualizarAvisosNoticias } from "@/lib/actions/perfil";
import { Boton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ajustes de avisos" };
export const dynamic = "force-dynamic";

export default async function AjustesAvisosPage() {
  const sesion = await currentUser();

  if (!sesion) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">Ajustes de avisos</h1>
        <p className="text-[var(--color-muted)]">Entra con Discord para verlos.</p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value="/avisos/ajustes" />
          <Boton variante="primary" type="submit" className="btn--redondo">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  const usuario = await db.user.findUnique({
    where: { id: sesion.id },
    select: { avisosNoticias: true },
  });

  return (
    <div className="shell grid max-w-[46rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/avisos" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Avisos
      </Link>

      <h1 className="display text-(length:--text-display-s)">Ajustes de avisos</h1>

      <section
        className="tile tile--suave flex flex-wrap items-center justify-between gap-[var(--space-md)]"
      >
        <div className="grid gap-[var(--space-2xs)]">
          <h2 className="display text-(length:--text-md)">Noticias por Discord</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {usuario?.avisosNoticias
              ? "Te avisamos por privado cada vez que se publica una noticia."
              : "Actívalo para que te avisemos por privado cuando se publique una noticia."}
          </p>
        </div>
        <form action={actualizarAvisosNoticias.bind(null, !usuario?.avisosNoticias)}>
          <Boton type="submit" className="btn--redondo">
            {usuario?.avisosNoticias ? (
              <>
                <BellOff size={15} aria-hidden />
                Desactivar
              </>
            ) : (
              <>
                <Bell size={15} aria-hidden />
                Activar
              </>
            )}
          </Boton>
        </form>
      </section>
    </div>
  );
}
