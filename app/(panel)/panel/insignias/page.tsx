import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { INSIGNIAS } from "@/lib/insignias/catalogo";
import { sincronizarATodos } from "@/lib/insignias/sincronizar";
import { formatearFecha } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";

export const metadata: Metadata = { title: "Insignias" };
export const dynamic = "force-dynamic";

/** Cuántos dueños se enseñan de cada una antes de resumir con un «y N más». */
const MUESTRA = 8;

type Llevada = {
  slug: string;
  grantedAt: Date;
  user: { id: string; username: string; avatar: string | null };
};

export default async function PanelInsigniasPage() {
  const usuario = await requireUser("INICIADOR");

  // Cuántas hay de cada una, y solo la muestra que se enseña. Antes se traían
  // todas las repartidas para acabar pintando ocho de cada: con la web llena eso
  // es leer la tabla entera para no usarla.
  const [conteos, muestras] = await Promise.all([
    db.userBadge.groupBy({ by: ["slug"], _count: { _all: true } }),
    Promise.all(
      INSIGNIAS.map((insignia) =>
        db.userBadge.findMany({
          where: { slug: insignia.slug },
          orderBy: { grantedAt: "desc" },
          take: MUESTRA,
          select: {
            slug: true,
            grantedAt: true,
            user: { select: { id: true, username: true, avatar: true } },
          },
        }),
      ),
    ),
  ]);

  const cuantas = new Map(conteos.map((fila) => [fila.slug, fila._count._all]));
  const porSlug = new Map<string, Llevada[]>(
    INSIGNIAS.map((insignia, indice) => [insignia.slug, muestras[indice]]),
  );

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Insignias"
        descripcion="Se ganan solas: cada una tiene su condición y se concede en cuanto se cumple. Nadie las reparte a mano."
        acciones={
          usuario.role === "ADMIN" ? (
            <form
              action={async () => {
                "use server";
                await sincronizarATodos();
              }}
            >
              <Boton type="submit">Repasar a todos</Boton>
            </form>
          ) : null
        }
      />

      <ul className="grid gap-[var(--space-md)]">
        {INSIGNIAS.map((insignia) => {
          const suyas = porSlug.get(insignia.slug) ?? [];
          const total = cuantas.get(insignia.slug) ?? 0;

          return (
            <li key={insignia.slug} className="tile grid gap-[var(--space-sm)]">
              <div className="flex flex-wrap items-start justify-between gap-[var(--space-md)]">
                <div className="grid gap-[var(--space-2xs)]">
                  <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                    <Insignia
                      nombre={insignia.nombre}
                      icono={insignia.icono}
                      descripcion={insignia.descripcion}
                    />
                    <span className="text-sm text-[var(--color-muted)]">
                      {insignia.descripcion}
                    </span>
                  </div>
                  <span className="meta">Se gana: {insignia.comoSeGana}</span>
                </div>

                <span className="display text-(length:--text-lg) tabular-nums">
                  {total}
                </span>
              </div>

              {suyas.length > 0 ? (
                <ul className="flex flex-wrap gap-[var(--space-md)]">
                  {suyas.map((fila) => (
                    <li key={fila.user.id}>
                      <Link
                        href={`/u/${fila.user.id}`}
                        className="flex items-center gap-[var(--space-xs)] text-sm hover:text-[var(--color-ink)]"
                      >
                        <Avatar
                          src={fila.user.avatar}
                          nombre={fila.user.username}
                          size={24}
                        />
                        {fila.user.username}
                        <span className="meta">{formatearFecha(fila.grantedAt)}</span>
                      </Link>
                    </li>
                  ))}
                  {total > suyas.length ? (
                    <li className="meta self-center">
                      y {total - suyas.length} más
                    </li>
                  ) : null}
                </ul>
              ) : (
                <span className="meta">Todavía no la tiene nadie</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="meta">
        El catálogo vive en lib/insignias/catalogo.ts. Al añadir una hay que
        pulsar «Repasar a todos»: si no, solo la ganaría quien hiciera algo
        después.
      </p>
    </div>
  );
}
