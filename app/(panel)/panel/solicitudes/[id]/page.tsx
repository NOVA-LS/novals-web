import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { traerForm, traerTitulos } from "@/lib/forms/registro";
import { formatearFechaHora } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { EstadoBadge } from "@/components/ui/badge";
import { NotasInternas } from "@/components/panel/notas-internas";
import { ResolverForm } from "@/components/panel/resolver-form";

export const metadata: Metadata = { title: "Solicitud" };
export const dynamic = "force-dynamic";

/** Notas internas que se traen sobre el jugador. Las últimas son las que valen. */
const MAX_NOTAS = 30;

export default async function SolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const revisor = await requireUser("INICIADOR");
  const { id } = await params;

  const solicitud = await db.submission.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      formVersion: true,
      answers: true,
      status: true,
      staffNote: true,
      createdAt: true,
      resolvedAt: true,
      user: { select: { id: true, username: true, discordId: true, avatar: true } },
      reviewer: { select: { username: true } },
    },
  });

  if (!solicitud) notFound();

  const form = await traerForm(solicitud.type);
  const titulos = await traerTitulos();
  const respuestas = (solicitud.answers ?? {}) as Record<string, unknown>;

  // Contexto sobre la persona antes de decidir: sus otras solicitudes y lo que
  // el staff haya apuntado sobre ella.
  const [historial, notas, siguiente] = await Promise.all([
    db.submission.findMany({
      where: { userId: solicitud.user.id, id: { not: id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, status: true, createdAt: true },
    }),
    db.userNote.findMany({
      where: { userId: solicitud.user.id },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTAS,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatar: true } },
      },
    }),
    // La más vieja sin resolver: revisar de una en una sin volver a la bandeja.
    db.submission.findFirst({
      where: { status: { in: ["PENDING", "IN_REVIEW"] }, id: { not: id } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        user: { select: { username: true } },
      },
    }),
  ]);

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <Link href="/panel/solicitudes" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Solicitudes
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          {/* El retrato lleva a su perfil: así el enlace no ocupa una línea
              suelta entre los datos. */}
          <Link href={`/u/${solicitud.user.id}`} className="shrink-0">
            <Avatar
              src={solicitud.user.avatar}
              nombre={solicitud.user.username}
              size={40}
            />
          </Link>
          <h1 className="display text-(length:--text-xl)">
            {form?.title ?? solicitud.type} ·{" "}
            <Link
              href={`/u/${solicitud.user.id}`}
              className="underline-offset-4 hover:underline"
            >
              {solicitud.user.username}
            </Link>
          </h1>
          <EstadoBadge status={solicitud.status} />
        </div>

        {/* Cada dato con su nombre encima: seguidos y en gris no se distinguía
            el identificador de Discord de la versión del formulario. */}
        <dl className="fichas">
          <div>
            <dt className="meta">Discord</dt>
            <dd className="tabular-nums">{solicitud.user.discordId}</dd>
          </div>
          <div>
            <dt className="meta">Enviada</dt>
            <dd>{formatearFechaHora(solicitud.createdAt)}</dd>
          </div>
          <div>
            <dt className="meta">Versión del formulario</dt>
            <dd>{solicitud.formVersion}</dd>
          </div>
          <div>
            <dt className="meta">Revisor</dt>
            <dd>{solicitud.reviewer?.username ?? "Sin asignar"}</dd>
          </div>
        </dl>
      </header>

      <section className="tile grid gap-[var(--space-md)]">
        <h2 className="display text-(length:--text-md)">Respuestas</h2>
        <dl className="grid gap-[var(--space-md)]">
          {(form?.fields ?? []).map((campo) => {
            const valor = respuestas[campo.name];
            return (
              <div key={campo.name} className="grid gap-[var(--space-2xs)]">
                <dt className="meta">{campo.label}</dt>
                <dd className="respuesta text-[var(--color-muted)]">
                  {campo.kind === "checkbox"
                    ? valor
                      ? "Sí"
                      : "No"
                    : campo.kind === "select"
                      ? // Guardada está la clave de la opción, que desde que los
                        // formularios se editan puede ser un «opcion_2»: aquí se
                        // enseña el texto que leyó quien contestó.
                        (campo.options.find((opcion) => opcion.value === valor)
                          ?.label ?? String(valor ?? "—"))
                      : String(valor ?? "—")}
                </dd>
              </div>
            );
          })}

          {/* Respuestas de versiones antiguas que ya no tienen pregunta asociada. */}
          {Object.entries(respuestas)
            .filter(
              ([nombre]) => !(form?.fields ?? []).some((c) => c.name === nombre),
            )
            .map(([nombre, valor]) => (
              <div key={nombre} className="grid gap-[var(--space-2xs)]">
                <dt className="meta">{nombre} · pregunta retirada</dt>
                <dd className="respuesta text-[var(--color-muted)]">
                  {String(valor ?? "—")}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="tile grid gap-[var(--space-md)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
          <h2 className="display text-(length:--text-md)">Resolver</h2>
          {siguiente ? (
            <Link
              href={`/panel/solicitudes/${siguiente.id}`}
              className="meta hover:text-[var(--color-ink)]"
            >
              Siguiente sin resolver · {siguiente.user.username} →
            </Link>
          ) : (
            <span className="meta">No queda ninguna más sin resolver</span>
          )}
        </div>
        <ResolverForm id={solicitud.id} notaInicial={solicitud.staffNote ?? ""} />
      </section>

      <NotasInternas
        userId={solicitud.user.id}
        nombre={solicitud.user.username}
        revisorId={revisor.id}
        esAdmin={revisor.role === "ADMIN"}
        notas={notas.map((nota) => ({
          ...nota,
          // La fecha se formatea aquí: el cliente no debe depender de la zona
          // horaria del navegador para algo que el staff compara entre sí.
          createdAt: formatearFechaHora(nota.createdAt),
        }))}
      />

      {historial.length > 0 ? (
        <section className="tile grid gap-[var(--space-sm)]">
          <h2 className="display text-(length:--text-md)">Historial del usuario</h2>
          <ul className="grid gap-[var(--space-xs)]">
            {historial.map((previa) => (
              <li key={previa.id} className="flex flex-wrap items-center gap-[var(--space-sm)]">
                <Link
                  href={`/panel/solicitudes/${previa.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {titulos.get(previa.type) ?? previa.type}
                </Link>
                <EstadoBadge status={previa.status} />
                <span className="meta">{formatearFechaHora(previa.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
