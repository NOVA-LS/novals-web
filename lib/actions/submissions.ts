"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { answersFromFormData, schemaFor } from "@/lib/forms";
import { traerForm } from "@/lib/forms/registro";
import { notifyStaff } from "@/lib/discord";
import { clamp, EMBED_COLOR } from "@/lib/embed";
import { avisarUsuario } from "@/lib/notifications";
import { avisarAlStaff, crearAviso } from "@/lib/avisos";
import { sincronizarInsignias } from "@/lib/insignias/sincronizar";
import { empujarADiscord } from "@/lib/discord/sincronizar";
import { sincronizarSiInvitado } from "@/lib/invitaciones";
import { CANAL, emitirA } from "@/lib/eventos";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import { consumir } from "@/lib/rate-limit";
import { puedeEnviar } from "@/lib/rules";
import type { Status } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ResultadoEnvio =
  | { ok: true; id: string }
  | { ok: false; mensaje: string; errores?: Record<string, string> };

export async function enviarSolicitud(
  tipo: string,
  datos: FormData,
): Promise<ResultadoEnvio> {
  const form = await traerForm(tipo);
  if (!form) return { ok: false, mensaje: "Ese formulario no existe." };

  let usuario;
  try {
    usuario = await requireUser();
  } catch {
    return { ok: false, mensaje: "Necesitas iniciar sesión con Discord." };
  }

  const limite = consumir(`envio:${usuario.id}`, 5, 60 * 60 * 1000);
  if (!limite.permitido) {
    return {
      ok: false,
      mensaje: "Has enviado demasiadas solicitudes seguidas. Prueba en un rato.",
    };
  }

  const config = await db.formConfig.findUnique({ where: { type: tipo } });

  // Una solicitud abierta por tipo, y cooldown tras un rechazo.
  const ultima = await db.submission.findFirst({
    where: { userId: usuario.id, type: tipo },
    orderBy: { createdAt: "desc" },
    select: { status: true, resolvedAt: true },
  });

  const veredicto = puedeEnviar({
    abierto: config?.open !== false,
    ultima,
    cooldownDays: config?.cooldownDays ?? 7,
  });

  if (!veredicto.permitido) {
    return { ok: false, mensaje: veredicto.motivo };
  }

  const parsed = schemaFor(form).safeParse(answersFromFormData(form, datos));
  if (!parsed.success) {
    const errores: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const campo = String(issue.path[0] ?? "");
      if (campo && !errores[campo]) errores[campo] = issue.message;
    }
    return { ok: false, mensaje: "Revisa los campos marcados.", errores };
  }

  const solicitud = await db.submission.create({
    data: {
      type: tipo,
      formVersion: form.version,
      userId: usuario.id,
      answers: parsed.data as Prisma.InputJsonValue,
      status: "PENDING",
    },
    select: { id: true },
  });

  await notifyStaff({
    title: `Nueva solicitud · ${form.title}`,
    description: `De **${usuario.username}** (<@${usuario.discordId}>)`,
    color: EMBED_COLOR.pending,
    fields: form.fields.slice(0, 4).map((campo) => ({
      name: campo.label,
      value: clamp(String(parsed.data[campo.name] ?? "—")),
    })),
  });

  await avisarUsuario(usuario.discordId, {
    evento: "recibida",
    formTitle: form.title,
  });

  // Y en la campana del panel, que es donde se trabaja: el webhook se pierde
  // entre el resto del canal, y quien revisa no siempre tiene Discord delante.
  await avisarAlStaff({
    tipo: "SOLICITUD",
    titulo: `Nueva solicitud de ${form.title} · ${usuario.username}`,
    url: `/panel/solicitudes/${solicitud.id}`,
    excepto: usuario.id,
  });

  revalidatePath("/perfil");
  revalidatePath("/panel/solicitudes");
  emitirA([CANAL.panel()]);

  return { ok: true, id: solicitud.id };
}

export async function resolverSolicitud(
  id: string,
  estado: Extract<Status, "IN_REVIEW" | "ACCEPTED" | "REJECTED">,
  nota: string,
) {
  const revisor = await requireUser("INICIADOR");

  const solicitud = await db.submission.update({
    where: { id },
    data: {
      status: estado,
      reviewerId: revisor.id,
      staffNote: nota.trim() || null,
      resolvedAt: estado === "IN_REVIEW" ? null : new Date(),
    },
    select: {
      id: true,
      type: true,
      user: { select: { id: true, username: true, discordId: true } },
    },
  });

  const form = await traerForm(solicitud.type);
  const titulo = form?.title ?? solicitud.type;
  const color =
    estado === "ACCEPTED"
      ? EMBED_COLOR.accepted
      : estado === "REJECTED"
        ? EMBED_COLOR.rejected
        : EMBED_COLOR.neutral;

  // La nota va también al canal de staff: es lo primero que se pregunta cuando
  // alguien ve un rechazo y quien no revisó no tiene por qué abrir el panel.
  const limpia = nota.trim();

  await notifyStaff({
    title: `Solicitud resuelta · ${titulo}`,
    description: `**${solicitud.user.username}** (<@${solicitud.user.discordId}>) → ${estado}\nRevisor: ${revisor.username}`,
    color,
    fields: limpia
      ? [
          {
            name: estado === "REJECTED" ? "Motivo del rechazo" : "Nota del staff",
            value: clamp(limpia),
          },
        ]
      : [],
  });

  if (estado === "IN_REVIEW") {
    await avisarUsuario(solicitud.user.discordId, {
      evento: "en_revision",
      formTitle: titulo,
    });
  } else {
    // El cooldown solo se anuncia en el rechazo, que es cuando importa saberlo.
    const config =
      estado === "REJECTED"
        ? await db.formConfig.findUnique({ where: { type: solicitud.type } })
        : null;

    await avisarUsuario(solicitud.user.discordId, {
      evento: "resuelta",
      formTitle: titulo,
      estado,
      nota: limpia || null,
      cooldownDays: config?.cooldownDays ?? 7,
    });
  }

  // El mismo aviso, dentro de la web: el privado de Discord no llega si los
  // tiene cerrados, y esto es lo único que entonces le queda por ver.
  await crearAviso({
    userId: solicitud.user.id,
    tipo: "SOLICITUD",
    titulo:
      estado === "ACCEPTED"
        ? `Tu solicitud de ${titulo} está aceptada`
        : estado === "REJECTED"
          ? `Tu solicitud de ${titulo} se ha rechazado`
          : `Tu solicitud de ${titulo} está en revisión`,
    cuerpo: limpia || null,
    url: "/perfil#solicitudes",
  });

  // La whitelist se guarda en el usuario: la preguntan el foro, el perfil y las
  // insignias, y así no hay que deducirla de las solicitudes en cada carga.
  if (solicitud.type === "whitelist" && estado !== "IN_REVIEW") {
    await db.user.update({
      where: { id: solicitud.user.id },
      data: { whitelisted: estado === "ACCEPTED" },
    });
    // Y con ella se mueve su rol en Discord.
    await empujarADiscord(solicitud.user.id);
    // Y si le trajo alguien, a quien le trajo se le pone al día lo que gane.
    if (estado === "ACCEPTED") await sincronizarSiInvitado(solicitud.user.id);
  }

  // Aceptar una solicitud cambia lo que le corresponde llevar.
  if (estado === "ACCEPTED") await sincronizarInsignias(solicitud.user.id);

  await apuntar({
    accion: ACCIONES.SOLICITUD,
    actor: revisor,
    objetivo: `${titulo} de ${solicitud.user.username}`,
    url: `/panel/solicitudes/${id}`,
    detalle: limpia ? `${estado} · ${limpia}` : estado,
  });

  revalidatePath("/panel/solicitudes");
  revalidatePath(`/panel/solicitudes/${id}`);
  revalidatePath("/perfil");
  emitirA([CANAL.panel(), CANAL.usuario(solicitud.user.id)]);
}
