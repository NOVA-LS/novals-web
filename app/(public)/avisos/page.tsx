import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Award, Bell, FileCheck2, MessageSquare } from "lucide-react";
import { currentUser } from "@/lib/guards";
import { contarAvisos, listarAvisos } from "@/lib/avisos";
import { entrarConDiscord } from "@/lib/actions/auth";
import { abrirAviso, marcarTodoLeido } from "@/lib/actions/avisos";
import { leerPagina, paginar } from "@/lib/paginacion";
import { formatearFechaHora } from "@/lib/utils";
import { Boton } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 20;

const ICONO = {
  RESPUESTA: MessageSquare,
  SOLICITUD: FileCheck2,
  INSIGNIA: Award,
} as const;

export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const usuario = await currentUser();
  const { p } = await searchParams;

  if (!usuario) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">Avisos</h1>
        <p className="text-[var(--color-muted)]">
          Entra con Discord para ver lo que te hemos avisado.
        </p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value="/avisos" />
          <Boton variante="primary" type="submit" className="btn--redondo">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  const total = await contarAvisos(usuario.id);
  const pagina = paginar(total, POR_PAGINA, leerPagina(p));
  const avisos = await listarAvisos(usuario.id, pagina.salta, pagina.toma);
  const sinLeer = avisos.some((aviso) => aviso.readAt === null);

  return (
    <div className="shell grid max-w-[52rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/perfil" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Mi perfil
      </Link>

      <div className="grid gap-[var(--space-sm)]">
        <div className="section-head section-head--fila section-head--sinregla">
          <h1 className="display text-(length:--text-display-s)">Avisos</h1>
          {sinLeer ? (
            <form action={marcarTodoLeido}>
              <Boton type="submit" className="btn--redondo">
                Marcar todo leído
              </Boton>
            </form>
          ) : null}
        </div>

        {avisos.length === 0 ? (
          <p className="text-[var(--color-muted)]">
            Tu buzón sobre todas las novedades respecto a ti.
          </p>
        ) : null}
      </div>

      {avisos.length > 0 ? (
        <>
          <ul className="grid gap-[var(--space-xs)]">
            {avisos.map((aviso) => {
              const Icono = ICONO[aviso.kind as keyof typeof ICONO] ?? Bell;

              return (
                <li key={aviso.id}>
                  {/* Por la acción, y no por un enlace suelto: abrirlo desde
                      aquí tiene que dejarlo leído igual que desde la campana. */}
                  <form action={abrirAviso}>
                    <input type="hidden" name="id" value={aviso.id} />
                    <button
                      type="submit"
                      className="tile tile--link flex w-full items-start gap-[var(--space-sm)] py-[var(--space-sm)] text-left"
                      data-nuevo={aviso.readAt === null}
                    >
                      <Icono
                        size={16}
                        className="mt-[0.2rem] shrink-0 text-[var(--color-neutral)]"
                        aria-hidden
                      />
                      <span className="grid min-w-0 gap-[var(--space-2xs)]">
                        <span
                          className={
                            aviso.readAt === null
                              ? "text-[var(--color-ink)]"
                              : "text-[var(--color-muted)]"
                          }
                        >
                          {aviso.title}
                        </span>
                        {aviso.body ? (
                          <span className="text-sm text-[var(--color-neutral)]">
                            {aviso.body}
                          </span>
                        ) : null}
                        <span className="meta">
                          {formatearFechaHora(aviso.createdAt)}
                          {aviso.readAt === null ? " · sin leer" : ""}
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <Paginacion
            pagina={pagina}
            href={(numero) => `/avisos?p=${numero}`}
            etiqueta="Páginas de avisos"
          />
        </>
      ) : null}
    </div>
  );
}
