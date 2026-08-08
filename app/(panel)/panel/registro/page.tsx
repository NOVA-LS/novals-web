import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { ACCION_TEXTO, type Accion } from "@/lib/auditoria";
import { leerPagina, paginar } from "@/lib/paginacion";
import { formatearFechaHora, hace } from "@/lib/utils";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import { EnlaceBoton } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Registro" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string; p?: string }>;
}) {
  // Lo mira administración: aquí se ve lo que ha hecho el resto del staff.
  await requireUser("ADMIN");
  const { accion, p } = await searchParams;

  const acciones = Object.keys(ACCION_TEXTO) as Accion[];
  const filtro = acciones.includes(accion as Accion) ? (accion as Accion) : undefined;
  const where = filtro ? { accion: filtro } : {};

  const total = await db.auditLog.count({ where });
  const pagina = paginar(total, POR_PAGINA, leerPagina(p));

  const [registros, porAccion] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagina.salta,
      take: pagina.toma,
      select: {
        id: true,
        accion: true,
        actorId: true,
        actorNombre: true,
        objetivo: true,
        url: true,
        detalle: true,
        createdAt: true,
      },
    }),
    db.auditLog.groupBy({ by: ["accion"], _count: { _all: true } }),
  ]);

  const cuenta = new Map(porAccion.map((fila) => [fila.accion, fila._count._all]));

  const enlace = (valor: string) =>
    valor ? `/panel/registro?accion=${valor}` : "/panel/registro";

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Registro"
        descripcion="Lo que ha hecho el staff: ascensos, resoluciones, cierres y borrados. No se puede editar ni borrar desde aquí."
      />

      <div className="flex flex-wrap gap-[var(--space-xs)]">
        <Link href={enlace("")} className="chip" data-activo={!filtro}>
          Todo
          <span className="chip__n">{total}</span>
        </Link>
        {acciones.map((valor) => (
          <Link
            key={valor}
            href={enlace(valor)}
            className="chip"
            data-activo={filtro === valor}
          >
            {ACCION_TEXTO[valor]}
            <span className="chip__n">{cuenta.get(valor) ?? 0}</span>
          </Link>
        ))}
      </div>

      {registros.length === 0 ? (
        <div className="tile grid justify-items-start gap-[var(--space-sm)]">
          <p className="text-[var(--color-muted)]">
            {filtro ? "Nada de este tipo todavía." : "Aún no hay nada apuntado."}
          </p>
          {filtro ? (
            <EnlaceBoton href="/panel/registro">Ver todo</EnlaceBoton>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-[var(--space-2xs)]">
          {registros.map((registro) => (
            <li
              key={registro.id}
              className="tile grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
            >
              <span className="flex flex-wrap items-center gap-[var(--space-sm)]">
                <span className="meta">
                  {ACCION_TEXTO[registro.accion as Accion] ?? registro.accion}
                </span>

                {registro.url ? (
                  <Link
                    href={registro.url}
                    className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
                  >
                    {registro.objetivo}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{registro.objetivo}</span>
                )}

                {registro.detalle ? (
                  <span className="text-sm text-[var(--color-muted)]">
                    {registro.detalle}
                  </span>
                ) : null}
              </span>

              <span className="meta">
                {registro.actorId ? (
                  <Link
                    href={`/u/${registro.actorId}`}
                    className="hover:text-[var(--color-ink)]"
                  >
                    {registro.actorNombre}
                  </Link>
                ) : (
                  registro.actorNombre
                )}
                {" · "}
                {hace(registro.createdAt)}
                {" · "}
                {formatearFechaHora(registro.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        href={(numero) =>
          filtro
            ? `/panel/registro?accion=${filtro}&p=${numero}`
            : `/panel/registro?p=${numero}`
        }
        etiqueta="Páginas del registro"
      />
    </div>
  );
}
