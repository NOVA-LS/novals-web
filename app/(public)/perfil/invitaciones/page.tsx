import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/guards";
import { Badge } from "@/components/ui/badge";
import { Boton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { entrarConDiscord } from "@/lib/actions/auth";
import { INSIGNIAS, type MetricasJugador } from "@/lib/insignias/catalogo";
import { metricasDe } from "@/lib/insignias/sincronizar";
import { EnlaceInvitacion } from "@/components/perfil/enlace-invitacion";

export const metadata: Metadata = { title: "Invitaciones" };
export const dynamic = "force-dynamic";

/** En este orden: es el que sigue la barra de progreso. */
const INSIGNIAS_INVITACION = ["reclutador", "embajador"];

export default async function InvitacionesPage() {
  const usuario = await currentUser();

  if (!usuario) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">Invitaciones</h1>
        <p className="text-[var(--color-muted)]">
          Entra con Discord para ver tu enlace y quién se ha registrado con él.
        </p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value="/perfil/invitaciones" />
          <Boton variante="primary" type="submit">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  const [invitados, metricas, invitadosLista] = await Promise.all([
    db.user.count({ where: { referredById: usuario.id, whitelisted: true } }),
    metricasDe(usuario.id),
    db.user.findMany({
      where: { referredById: usuario.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, avatar: true, whitelisted: true },
    }),
  ]);

  const insigniasInvitacion = INSIGNIAS.filter((insignia) =>
    INSIGNIAS_INVITACION.includes(insignia.slug),
  );
  const misInsigniasInvitacion = await db.userBadge.findMany({
    where: { userId: usuario.id, slug: { in: INSIGNIAS_INVITACION } },
    select: { slug: true },
  });
  const yaGanadas = new Set(misInsigniasInvitacion.map((fila) => fila.slug));
  const siguienteInsignia = insigniasInvitacion.find(
    (insignia) => !yaGanadas.has(insignia.slug),
  );
  const avanceInvitacion =
    siguienteInsignia && metricas
      ? siguienteInsignia.avance?.(metricas as MetricasJugador)
      : null;

  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const enlaceInvitacion = `${baseUrl}/r/${usuario.id}`;

  return (
    <div className="shell grid max-w-[42rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/perfil" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Mi perfil
      </Link>

      <div className="section-head section-head--fila">
        <h1 className="display text-(length:--text-display-s)">Invitaciones</h1>
        <span className="meta">
          {invitados} {invitados === 1 ? "invitado con whitelist" : "invitados con whitelist"}
        </span>
      </div>

      <div className="tile grid gap-[var(--space-sm)]">
        <p className="text-sm text-[var(--color-muted)]">
          Comparte tu enlace. Cuando quien entre por ahí pase la whitelist,
          cuenta para tus insignias.
        </p>
        <EnlaceInvitacion enlace={enlaceInvitacion} />

        {siguienteInsignia && avanceInvitacion != null && avanceInvitacion > 0 ? (
          <div
            className="progreso"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(avanceInvitacion * 100)}
            aria-label={`Progreso de ${siguienteInsignia.nombre}`}
            style={{ ["--avance" as string]: `${Math.round(avanceInvitacion * 100)}%` }}
          />
        ) : null}

        {invitadosLista.length === 0 ? (
          <p className="meta">Nadie todavía. Comparte tu enlace.</p>
        ) : (
          <ul className="grid gap-[var(--space-xs)]">
            {invitadosLista.map((invitado) => (
              <li
                key={invitado.id}
                className="flex items-center justify-between gap-[var(--space-sm)]"
              >
                <span className="flex items-center gap-[var(--space-xs)]">
                  <Avatar src={invitado.avatar} nombre={invitado.username} size={24} />
                  {invitado.username}
                </span>
                <Badge tono={invitado.whitelisted ? "accepted" : "neutral"}>
                  {invitado.whitelisted ? "Con whitelist" : "Sin whitelist todavía"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
