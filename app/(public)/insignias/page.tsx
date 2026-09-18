import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/guards";
import { INSIGNIAS } from "@/lib/insignias/catalogo";
import { metricasDe } from "@/lib/insignias/sincronizar";
import { formatearFecha } from "@/lib/utils";
import { Insignia } from "@/components/ui/insignia";

export const metadata: Metadata = { title: "Insignias" };
export const dynamic = "force-dynamic";

export default async function InsigniasPage() {
  const usuario = await currentUser();

  // Con sesión se enseña además lo que llevas de cada una; sin ella, el
  // catálogo se lee igual: es parte de lo que se cuenta del servidor.
  const [mias, metricas] = usuario
    ? await Promise.all([
        db.userBadge.findMany({
          where: { userId: usuario.id },
          select: { slug: true, grantedAt: true },
        }),
        metricasDe(usuario.id),
      ])
    : [[], null];

  const ganadas = new Map(mias.map((fila) => [fila.slug, fila.grantedAt]));

  return (
    <div className="shell grid max-w-[52rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Inicio
      </Link>

      <div className="grid gap-[var(--space-sm)]">
        <h1 className="display text-(length:--text-display-s)">Insignias</h1>
        <p className="text-[var(--color-muted)]">
          No se piden ni se regalan: se ganan solas al cumplir lo que dicen.
          {usuario ? ` Llevas ${ganadas.size} de ${INSIGNIAS.length}.` : ""}
        </p>
      </div>

      <ul className="grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
        {INSIGNIAS.map((insignia) => {
          const desde = ganadas.get(insignia.slug);
          const avance =
            metricas && !desde && insignia.avance ? insignia.avance(metricas) : null;

          return (
            <li
              key={insignia.slug}
              className="tile tile--suave flex flex-col gap-[var(--space-xs)]"
              // Las que ya llevas se ven enteras; las que no, apagadas.
              data-ganada={desde ? true : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
                <Insignia
                  nombre={insignia.nombre}
                  icono={insignia.icono}
                  descripcion={insignia.descripcion}
                  className={desde ? undefined : "insignia--pendiente"}
                />
                {desde ? (
                  <span className="meta flex items-center gap-[var(--space-2xs)]">
                    <Check size={13} aria-hidden />
                    Desde {formatearFecha(desde)}
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-[var(--color-muted)]">
                {insignia.descripcion}
              </p>

              <span className="meta">{insignia.comoSeGana}</span>

              {/* Se ancla al pie (mt-auto): en una fila de grid las tarjetas
                  miden lo mismo, y sin esto el hueco de más quedaba partido
                  en medio en vez de debajo, del todo. Las que no cuentan
                  progreso (o tienes o no) simplemente no llevan esto, y el
                  hueco se queda abajo del texto como en cualquier tarjeta
                  más corta. */}
              {avance !== null ? (
                <div className="mt-auto grid gap-[var(--space-2xs)]">
                  <div
                    className="progreso"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(avance * 100)}
                    aria-label={`Progreso de ${insignia.nombre}`}
                    style={{ ["--avance" as string]: `${Math.round(avance * 100)}%` }}
                  />
                  <span className="meta">{Math.round(avance * 100)}%</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
