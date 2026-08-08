import "server-only";
import Link from "next/link";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { traerFormularios } from "@/lib/forms/registro";
import { currentUser } from "@/lib/guards";
import { puedeEnviar } from "@/lib/rules";
import { calcularEspera } from "@/lib/cooldown";
import { formatearFecha } from "@/lib/utils";
import { CuentaAtras } from "@/components/cuenta-atras";
import { Badge, EstadoBadge } from "@/components/ui/badge";

/**
 * Las postulaciones, con su estado real para quien mira.
 *
 * Vive aparte porque sale en dos sitios —la portada y la pantalla de
 * postulaciones— y tenían dos versiones distintas: en la portada todas parecían
 * abiertas y solo al entrar te enterabas de que te quedaban cuatro días de
 * espera. Ahora el candado y la cuenta atrás se ven desde el primer momento.
 */
export async function TarjetasPostulacion({
  titulo = "h2",
}: {
  /** En la portada cuelgan de un h2 de sección; en su propia página, del h1. */
  titulo?: "h2" | "h3";
}) {
  const Titulo = titulo;

  const [formularios, configs, usuario] = await Promise.all([
    traerFormularios(),
    db.formConfig.findMany(),
    currentUser(),
  ]);

  // La última de cada tipo: es la que decide si se puede volver a entrar. Se
  // pide una por formulario en vez de traerse el historial entero y quedarse con
  // la primera de cada uno: son cuatro consultas de una fila, no una de mil.
  const propias = usuario
    ? await Promise.all(
        formularios.map((form) =>
          db.submission.findFirst({
            where: { userId: usuario.id, type: form.type },
            orderBy: { createdAt: "desc" },
            select: { type: true, status: true, resolvedAt: true },
          }),
        ),
      )
    : [];

  const porTipo = new Map(configs.map((config) => [config.type, config]));
  const ultimaPorTipo = new Map(
    propias
      .filter((solicitud) => solicitud !== null)
      .map((solicitud) => [solicitud.type, solicitud]),
  );

  // Puede no haber ninguno: se montan desde el panel y la web no trae ninguno
  // puesto. Sin esto, aquí quedaría un hueco sin explicación.
  if (formularios.length === 0) {
    return (
      <p className="tile text-sm text-[var(--color-muted)]">
        No hay ninguna postulación montada todavía. Cuando se abra alguna,
        aparecerá aquí.
      </p>
    );
  }

  return (
    <div className="grid gap-[var(--space-md)] md:grid-cols-3">
      {formularios.map((form) => {
        const config = porTipo.get(form.type);
        const abierto = config?.open !== false;
        const ultima = ultimaPorTipo.get(form.type) ?? null;

        const veredicto = puedeEnviar({
          abierto,
          ultima,
          cooldownDays: config?.cooldownDays ?? 7,
        });

        // Sin sesión no se juzga a nadie: la propia página del formulario pide
        // entrar. Con sesión, si no puede enviar, tampoco entra.
        const abrible = veredicto.permitido || (!usuario && abierto);
        const enRevision =
          ultima?.status === "PENDING" || ultima?.status === "IN_REVIEW";

        const cuerpo = (
          <>
            <div className="flex items-start justify-between gap-[var(--space-sm)]">
              <Titulo className="display text-(length:--text-lg)">
                {form.title}
              </Titulo>
              {enRevision ? (
                <EstadoBadge status={ultima.status} />
              ) : (
                <Badge tono={abierto ? "accepted" : "rejected"}>
                  {abierto ? "Abierta" : "Cerrada"}
                </Badge>
              )}
            </div>

            <p className="text-sm text-[var(--color-muted)]">{form.summary}</p>
            <span className="meta">{form.fields.length} preguntas</span>
          </>
        );

        if (abrible) {
          return (
            <Link
              key={form.type}
              href={`/formularios/${form.type}`}
              className="tile grid content-start gap-[var(--space-sm)]"
            >
              {cuerpo}
            </Link>
          );
        }

        return (
          <div
            key={form.type}
            className="bloqueada tile grid content-start gap-[var(--space-sm)]"
          >
            {cuerpo}

            {/* Lo que impide entrar se dice aquí, no al llegar al trámite. */}
            <div className="bloqueada__velo">
              <Lock size={22} className="text-[var(--color-muted)]" aria-hidden />

              {veredicto.hasta ? (
                <>
                  <CuentaAtras
                    hasta={veredicto.hasta.getTime()}
                    desde={ultima?.resolvedAt?.getTime() ?? null}
                    inicial={calcularEspera(
                      veredicto.hasta.getTime(),
                      ultima?.resolvedAt?.getTime() ?? null,
                    )}
                    variante="linea"
                  />
                  <span className="meta">
                    Se reabre el {formatearFecha(veredicto.hasta)}
                  </span>
                </>
              ) : (
                <span className="max-w-[26ch] text-sm text-[var(--color-muted)]">
                  {veredicto.motivo}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
