import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { traerForm } from "@/lib/forms/registro";
import { currentUser } from "@/lib/guards";
import { puedeEnviar } from "@/lib/rules";
import { calcularEspera } from "@/lib/cooldown";
import { entrarConDiscord } from "@/lib/actions/auth";
import { formatearFecha, formatearFechaHora } from "@/lib/utils";
import { CuentaAtras } from "@/components/cuenta-atras";
import { FormRenderer } from "@/components/form-renderer";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { EstadoBadge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const form = await traerForm(tipo);
  return { title: form ? form.title : "Formulario" };
}

export default async function FormularioPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const form = await traerForm(tipo);
  if (!form) notFound();

  const [config, usuario] = await Promise.all([
    db.formConfig.findUnique({ where: { type: tipo } }),
    currentUser(),
  ]);

  const abierta = config?.open !== false;

  // La última de este tipo decide todo: si hay una en revisión, si hubo un
  // rechazo y cuánto queda de espera. La misma regla que aplica el envío.
  const ultima = usuario
    ? await db.submission.findFirst({
        where: { userId: usuario.id, type: tipo },
        orderBy: { createdAt: "desc" },
        select: { status: true, resolvedAt: true },
      })
    : null;

  const veredicto = puedeEnviar({
    abierto: abierta,
    ultima,
    cooldownDays: config?.cooldownDays ?? 7,
  });

  const enRevision =
    ultima?.status === "PENDING" || ultima?.status === "IN_REVIEW";
  const espera = veredicto.permitido ? undefined : veredicto.hasta;

  return (
    <div className="shell grid max-w-[68rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/formularios" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Postulaciones
      </Link>

      <header className="grid max-w-[62ch] gap-[var(--space-sm)]">
        <span className="meta">Formulario</span>
        <h1 className="display text-(length:--text-display-s)">{form.title}</h1>
        <p className="text-[var(--color-muted)]">{form.summary}</p>
      </header>

      {!abierta ? (
        <div className="tile grid gap-[var(--space-sm)]">
          <h2 className="display text-(length:--text-md)">Cerrada por ahora</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Esta postulación no admite envíos en este momento. Estate atento a
            las noticias: se avisa cuando vuelve a abrirse.
          </p>
          <div>
            <EnlaceBoton href="/noticias">Ver noticias</EnlaceBoton>
          </div>
        </div>
      ) : !usuario ? (
        <div className="tile grid gap-[var(--space-sm)]">
          <h2 className="display text-(length:--text-md)">Inicia sesión</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Vinculamos cada solicitud a tu cuenta de Discord para poder
            responderte por ahí.
          </p>
          <form action={entrarConDiscord}>
            <input type="hidden" name="destino" value={`/formularios/${tipo}`} />
            <Boton variante="primary" type="submit">
              Entrar con Discord
            </Boton>
          </form>
        </div>
      ) : enRevision && ultima ? (
        <div
          className="tile solicitud grid gap-[var(--space-sm)]"
          data-estado={ultima.status}
        >
          <div className="flex items-center gap-[var(--space-sm)]">
            <h2 className="display text-(length:--text-md)">Ya la enviaste</h2>
            <EstadoBadge status={ultima.status} />
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            Tienes una solicitud de este tipo en revisión. Espera respuesta
            antes de enviar otra.
          </p>
          <div>
            <EnlaceBoton href="/perfil">Ver mis solicitudes</EnlaceBoton>
          </div>
        </div>
      ) : espera ? (
        // Rechazada hace poco: el formulario ni se enseña, porque el envío lo
        // rechazaría igual y solo se habría perdido el rato de escribirlo.
        <div className="tile grid items-center gap-[var(--space-lg)] md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-[var(--space-sm)]">
            <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
              <Lock size={16} className="text-[var(--color-muted)]" aria-hidden />
              <span className="meta">Espera en curso</span>
            </div>

            <h2 className="display text-(length:--text-lg)">
              Todavía no puedes volver a enviarla
            </h2>

            <p className="max-w-[52ch] text-sm text-[var(--color-muted)]">
              {ultima?.resolvedAt
                ? `Se rechazó el ${formatearFecha(ultima.resolvedAt)}. `
                : ""}
              Se abre otra vez el{" "}
              <strong className="font-medium text-[var(--color-ink)]">
                {formatearFechaHora(espera)}
              </strong>
              . Aprovecha para repasar lo que escribiste: repetir la misma
              solicitud suele acabar igual.
            </p>

            <div className="flex flex-wrap gap-[var(--space-xs)]">
              <EnlaceBoton href="/perfil">Ver el motivo</EnlaceBoton>
              <EnlaceBoton href="/foro">Pasar por el foro</EnlaceBoton>
            </div>
          </div>

          <div className="grid gap-[var(--space-xs)] border-t border-[var(--color-rule)] pt-[var(--space-md)] md:border-t-0 md:border-l md:pt-0 md:pl-[var(--space-xl)]">
            <span className="meta">Te queda</span>
            <CuentaAtras
              hasta={espera.getTime()}
              desde={ultima?.resolvedAt?.getTime() ?? null}
              inicial={calcularEspera(
                espera.getTime(),
                ultima?.resolvedAt?.getTime() ?? null,
              )}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-[var(--space-xl)] lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <FormRenderer form={form} />

          <aside className="tile grid gap-[var(--space-md)] lg:sticky lg:top-24">
            <h2 className="display text-(length:--text-md)">Antes de escribir</h2>
            <ul className="grid gap-[var(--space-sm)] text-sm text-[var(--color-muted)]">
              <li>
                Se guarda un borrador en este navegador: puedes cerrar y seguir
                luego.
              </li>
              <li>
                Solo puedes tener una solicitud de este tipo en revisión a la
                vez.
              </li>
              <li>
                Si te rechazan, hay un tiempo de espera antes de volver a
                enviarla.
              </li>
              <li>Respuestas copiadas de otro servidor se notan y se rechazan.</li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
