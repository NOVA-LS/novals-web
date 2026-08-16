"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, requireUser } from "@/lib/guards";
import { schemaFor, type FormDefinition } from "@/lib/forms";
import { asuntoDe, getCategoriaTicket, type CategoriaTicket } from "@/lib/tickets/categorias";
import {
  atiende,
  esParte,
  estadoTrasMensaje,
  puedeCerrar,
  puedeEscribir,
  puedeEscribirInterno,
  puedeInvitar,
  puedeMover,
  puedeReabrir,
  puedeValorar,
  puedeVer,
  type ActorTicket,
  type TicketVisto,
} from "@/lib/tickets/reglas";
import { avisarAlStaff, crearAviso } from "@/lib/avisos";
import { CANAL, emitirA } from "@/lib/eventos";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import { sincronizarInsignias } from "@/lib/insignias/sincronizar";
import { consumir } from "@/lib/rate-limit";
import { guardarImagen } from "@/lib/uploads";
import { MAX_ADJUNTOS } from "@/lib/limites";
import { estaMirando } from "@/lib/tickets/presencia";
import type { Role } from "@/generated/prisma/enums";

export type ResultadoTicket =
  | { ok: true; id: string }
  | { ok: false; mensaje: string; errores?: Record<string, string> };

/**
 * Lee una lista de identificadores de Discord separados por comas.
 *
 * Se queda solo con lo que parece un identificador —son números largos— para
 * que pegar «@fulano, 123…» no acabe buscando un usuario llamado «@fulano».
 */
function idsDeDiscord(texto: string): string[] {
  const sueltos = texto
    .split(/[,\s]+/)
    .map((trozo) => trozo.trim())
    .filter((trozo) => /^\d{5,}$/.test(trozo));

  return [...new Set(sueltos)];
}

/** La definición de formulario que espera el motor de validación. */
function comoFormulario(categoria: CategoriaTicket): FormDefinition {
  return {
    type: categoria.clave,
    title: categoria.nombre,
    summary: categoria.descripcion,
    fields: categoria.campos,
  };
}

/**
 * Guarda las imágenes que vengan con un mensaje.
 *
 * Se para en el primer fallo y devuelve el motivo: es preferible a dejar el
 * mensaje publicado con la mitad de las pruebas.
 */
async function guardarAdjuntos(datos: FormData) {
  const archivos = datos
    .getAll("adjuntos")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0)
    .slice(0, MAX_ADJUNTOS);

  const guardadas = [];
  for (const archivo of archivos) {
    guardadas.push(await guardarImagen(archivo, "La imagen"));
  }
  return guardadas;
}

export async function abrirTicket(
  clave: string,
  datos: FormData,
): Promise<ResultadoTicket> {
  const categoria = getCategoriaTicket(clave);
  if (!categoria) return { ok: false, mensaje: "Esa categoría no existe." };

  let usuario;
  try {
    usuario = await requireUser();
  } catch {
    return { ok: false, mensaje: "Necesitas iniciar sesión con Discord." };
  }

  const limite = consumir(`ticket:${usuario.id}`, 5, 60 * 60 * 1000);
  if (!limite.permitido) {
    return { ok: false, mensaje: "Has abierto muchos tickets seguidos. Espera un poco." };
  }

  const forma = comoFormulario(categoria);
  const bruto: Record<string, unknown> = {};
  for (const campo of categoria.campos) {
    const valor = datos.get(campo.name);
    bruto[campo.name] =
      campo.kind === "checkbox" ? valor === "on" || valor === "true" : (valor ?? "");
  }

  const parsed = schemaFor(forma).safeParse(bruto);
  if (!parsed.success) {
    const errores: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const campo = String(issue.path[0] ?? "");
      if (campo && !errores[campo]) errores[campo] = issue.message;
    }
    return { ok: false, mensaje: "Revisa los campos marcados.", errores };
  }

  let adjuntos;
  try {
    adjuntos = await guardarAdjuntos(datos);
  } catch (error) {
    return {
      ok: false,
      mensaje: error instanceof Error ? error.message : "No se pudo subir la imagen.",
    };
  }

  // A quién más va el ticket. Por identificador de Discord y no por nombre: el
  // nombre se cambia y se repite, y meter a quien no era en un reporte es
  // exactamente lo que no puede pasar.
  const pedidos = idsDeDiscord(String(datos.get("acompanantes") ?? ""));
  let acompanantes: string[] = [];

  if (pedidos.length > 0) {
    const encontrados = await db.user.findMany({
      where: { discordId: { in: pedidos } },
      select: { id: true, discordId: true },
    });

    const conocidos = new Set(encontrados.map((persona) => persona.discordId));
    const desconocidos = pedidos.filter((id) => !conocidos.has(id));

    if (desconocidos.length > 0) {
      return {
        ok: false,
        mensaje: `Estos identificadores no han entrado nunca en la web: ${desconocidos.join(", ")}.`,
      };
    }

    // Meterse a uno mismo no cuenta: ya es el autor.
    acompanantes = encontrados
      .map((persona) => persona.id)
      .filter((id) => id !== usuario.id);
  }

  const respuestas = parsed.data as Record<string, unknown>;
  const asunto = asuntoDe(categoria, respuestas);
  const detalle = String(respuestas.detalle ?? "").trim();

  // El número corto y el ticket se calculan juntos: si dos entran a la vez, la
  // transacción decide el orden y no salen dos con el mismo.
  const ticket = await db.$transaction(async (tx) => {
    const ultimo = await tx.ticket.aggregate({ _max: { numero: true } });

    return tx.ticket.create({
      data: {
        numero: (ultimo._max.numero ?? 0) + 1,
        category: categoria.clave,
        subject: asunto,
        answers: respuestas as object,
        nivel: categoria.nivel,
        authorId: usuario.id,
        invitados: {
          create: acompanantes.map((userId) => ({ userId })),
        },
        messages: {
          create: {
            authorId: usuario.id,
            body: detalle,
            adjuntos: { create: adjuntos },
          },
        },
      },
      select: { id: true, numero: true },
    });
  });

  await avisarAlStaff({
    tipo: "TICKET",
    titulo: `Ticket #${ticket.numero} · ${categoria.nombre}`,
    cuerpo: asunto,
    url: `/panel/tickets/${ticket.id}`,
    desdeNivel: categoria.nivel,
    excepto: usuario.id,
  });

  for (const invitado of acompanantes) {
    await crearAviso({
      userId: invitado,
      tipo: "TICKET",
      titulo: `${usuario.username} te ha metido en el ticket #${ticket.numero}`,
      cuerpo: asunto,
      url: `/tickets/${ticket.id}`,
    });
  }

  revalidatePath("/tickets");
  revalidatePath("/panel/tickets");
  emitirA([CANAL.panel(), ...acompanantes.map((id) => CANAL.usuario(id))]);

  return { ok: true, id: ticket.id };
}

/** Lo que hace falta para decidir si alguien puede tocar un ticket. */
async function cargar(id: string) {
  const usuario = await currentUser();
  const fila = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      subject: true,
      authorId: true,
      nivel: true,
      status: true,
      assigneeId: true,
      valoracion: true,
      invitados: { select: { userId: true } },
    },
  });

  const actor: ActorTicket = usuario
    ? { id: usuario.id, role: usuario.role }
    : null;

  // Los invitados se aplanan a una lista de identificadores: es lo que esperan
  // las reglas, que no saben nada de tablas.
  const ticket = fila
    ? { ...fila, invitados: fila.invitados.map((fila) => fila.userId) }
    : null;

  return { usuario, actor, ticket };
}

export async function responderTicket(
  id: string,
  datos: FormData,
): Promise<ResultadoTicket> {
  const { usuario, actor, ticket } = await cargar(id);
  if (!ticket || !actor || !usuario) {
    return { ok: false, mensaje: "Ese ticket ya no existe." };
  }

  const vista: TicketVisto = ticket;
  if (!puedeEscribir(actor, vista)) {
    return { ok: false, mensaje: "Este ticket no es tuyo." };
  }

  const interno = datos.get("interno") === "on";
  if (interno && !puedeEscribirInterno(actor, vista)) {
    return { ok: false, mensaje: "Las notas internas son del staff." };
  }

  const texto = String(datos.get("mensaje") ?? "").trim();
  if (texto.length < 2) return { ok: false, mensaje: "El mensaje está vacío." };
  if (texto.length > 4000) return { ok: false, mensaje: "El mensaje es larguísimo." };

  const limite = consumir(`ticket-msg:${actor.id}`, 30, 60 * 60 * 1000);
  if (!limite.permitido) {
    return { ok: false, mensaje: "Vas muy rápido. Espera un poco." };
  }

  let adjuntos;
  try {
    adjuntos = await guardarAdjuntos(datos);
  } catch (error) {
    return {
      ok: false,
      mensaje: error instanceof Error ? error.message : "No se pudo subir la imagen.",
    };
  }

  const comoStaff = !esParte(actor, vista) && atiende(actor, vista);
  const estado = estadoTrasMensaje(vista, comoStaff ? "staff" : "autor", interno);

  await db.$transaction([
    db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: actor.id,
        body: texto,
        interno,
        adjuntos: { create: adjuntos },
      },
    }),
    db.ticket.update({
      where: { id: ticket.id },
      data: {
        status: estado,
        lastMessageAt: new Date(),
        // El primero del staff que contesta se queda el ticket.
        assigneeId: comoStaff && !ticket.assigneeId ? actor.id : undefined,
      },
    }),
  ]);

  // Una nota interna no se le anuncia a nadie de fuera.
  if (!interno) {
    if (comoStaff) {
      // A todo el lado del jugador: el que lo abrió y los que van con él.
      for (const destinatario of [ticket.authorId, ...ticket.invitados]) {
        await crearAviso({
          userId: destinatario,
          tipo: "TICKET",
          titulo: `Respuesta en tu ticket #${ticket.numero}`,
          cuerpo: texto,
          url: `/tickets/${ticket.id}`,
        });
      }
    } else {
      // Y si escribe uno de ellos, se avisa a los demás además de al staff.
      for (const destinatario of [ticket.authorId, ...ticket.invitados]) {
        if (destinatario === actor.id) continue;
        await crearAviso({
          userId: destinatario,
          tipo: "TICKET",
          titulo: `${usuario.username} escribió en el ticket #${ticket.numero}`,
          cuerpo: texto,
          url: `/tickets/${ticket.id}`,
        });
      }

      await avisarAlStaff({
        tipo: "TICKET",
        titulo: `${usuario.username} respondió en el ticket #${ticket.numero}`,
        cuerpo: texto,
        url: `/panel/tickets/${ticket.id}`,
        desdeNivel: ticket.nivel,
        excepto: actor.id,
      });
    }
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath(`/panel/tickets/${ticket.id}`);
  revalidatePath("/panel/tickets");
  emitirA([CANAL.ticket(ticket.id), CANAL.panel()]);

  return { ok: true, id: ticket.id };
}

export async function cerrarTicket(id: string): Promise<ResultadoTicket> {
  const { usuario, actor, ticket } = await cargar(id);
  if (!ticket || !actor) return { ok: false, mensaje: "Ese ticket ya no existe." };

  if (!puedeCerrar(actor, ticket)) {
    return { ok: false, mensaje: "No puedes cerrar este ticket." };
  }

  await db.ticket.update({
    where: { id },
    data: { status: "CERRADO", closedAt: new Date() },
  });

  // Solo cuando lo cierra el staff: que su autor dé por resuelto lo suyo no es
  // una decisión que haya que poder auditar.
  if (atiende(actor, ticket) && usuario) {
    await apuntar({
      accion: ACCIONES.TICKET,
      actor: usuario,
      objetivo: `#${ticket.numero} · ${ticket.subject}`,
      url: `/panel/tickets/${id}`,
      detalle: "cerrado",
    });
  }

  // Se avisa a todo el lado del jugador, menos a quien lo acaba de cerrar. A su
  // autor se le pide además que puntúe: es el único momento en que la pregunta
  // tiene sentido, y quien la contesta es quien vino a que le atendieran.
  const loCerroElStaff = atiende(actor, ticket);

  for (const destinatario of [ticket.authorId, ...ticket.invitados]) {
    if (destinatario === actor.id) continue;

    const esSuAutor = destinatario === ticket.authorId;
    const pideValoracion = esSuAutor && loCerroElStaff;

    await crearAviso({
      userId: destinatario,
      tipo: "TICKET",
      titulo: pideValoracion
        ? `¿Qué tal te atendieron en el ticket #${ticket.numero}?`
        : `El ticket #${ticket.numero} se ha cerrado`,
      cuerpo: pideValoracion
        ? "Puntúalo del 0 al 5. Si quieres, cuenta por qué."
        : "Si te queda algo por resolver, abre otro.",
      url: pideValoracion ? `/tickets/${id}#valoracion` : `/tickets/${id}`,
    });
  }

  await sincronizarInsignias(ticket.authorId);

  revalidatePath(`/tickets/${id}`);
  revalidatePath("/tickets");
  revalidatePath(`/panel/tickets/${id}`);
  revalidatePath("/panel/tickets");
  emitirA([CANAL.ticket(id), CANAL.panel()]);

  return { ok: true, id };
}

/**
 * Guarda la nota que le pone el autor a la atención recibida.
 *
 * Se manda una sola vez: la regla lo comprueba contra la base, no contra lo que
 * diga la pantalla, porque la pantalla es del cliente y la nota ya enviada no.
 */
export async function valorarTicket(
  id: string,
  puntuacion: number,
  nota: string,
): Promise<ResultadoTicket> {
  const { actor, ticket } = await cargar(id);
  if (!ticket || !actor) return { ok: false, mensaje: "Ese ticket ya no existe." };

  if (!puedeValorar(actor, ticket)) {
    return {
      ok: false,
      mensaje:
        ticket.valoracion !== null
          ? "Este ticket ya está valorado."
          : "Esto solo lo valora quien abrió el ticket.",
    };
  }

  const valor = Math.trunc(Number(puntuacion));
  if (!Number.isFinite(valor) || valor < 0 || valor > 5) {
    return { ok: false, mensaje: "La nota va del 0 al 5." };
  }

  const limpia = nota.trim().slice(0, 500);

  await db.ticket.update({
    where: { id },
    data: {
      valoracion: valor,
      valoracionNota: limpia || null,
      valoradoAt: new Date(),
    },
  });

  // A quien lo llevó se le dice: es sobre su trabajo, y si no se le cuenta, la
  // valoración se queda en una estadística que no lee nadie.
  if (ticket.assigneeId && ticket.assigneeId !== actor.id) {
    await crearAviso({
      userId: ticket.assigneeId,
      tipo: "TICKET",
      titulo: `Valoraron el ticket #${ticket.numero} con un ${valor}/5`,
      cuerpo: limpia || null,
      url: `/panel/tickets/${id}`,
    });
  }

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/panel/tickets/${id}`);
  revalidatePath("/panel");
  emitirA([CANAL.ticket(id), CANAL.panel()]);

  return { ok: true, id };
}

/**
 * Vuelve a abrir uno cerrado.
 *
 * Solo el staff, y a propósito: un ticket cerrado ya no admite mensajes, así que
 * esta es la única puerta de vuelta cuando se cerró antes de tiempo.
 */
export async function reabrirTicket(id: string): Promise<ResultadoTicket> {
  const { usuario, actor, ticket } = await cargar(id);
  if (!ticket || !actor) return { ok: false, mensaje: "Ese ticket ya no existe." };

  if (!puedeReabrir(actor, ticket)) {
    return { ok: false, mensaje: "No puedes reabrir este ticket." };
  }

  await db.ticket.update({
    where: { id },
    data: { status: "EN_CURSO", closedAt: null, lastMessageAt: new Date() },
  });

  await apuntar({
    accion: ACCIONES.TICKET,
    actor: usuario,
    objetivo: `#${ticket.numero} · ${ticket.subject}`,
    url: `/panel/tickets/${id}`,
    detalle: "reabierto",
  });

  for (const destinatario of [ticket.authorId, ...ticket.invitados]) {
    await crearAviso({
      userId: destinatario,
      tipo: "TICKET",
      titulo: `Tu ticket #${ticket.numero} se ha reabierto`,
      url: `/tickets/${id}`,
    });
  }

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/panel/tickets/${id}`);
  revalidatePath("/panel/tickets");
  emitirA([CANAL.ticket(id), CANAL.panel()]);

  return { ok: true, id };
}

/**
 * Mete a otros jugadores en la conversación, por identificador de Discord.
 *
 * Admite varios de una vez, separados por comas: en un reporte con tres
 * implicados se pegan los tres y se acabó. El identificador es único y no
 * cambia, así que no hay forma de meter a quien no era.
 */
export async function invitarAlTicket(
  id: string,
  identificadores: string,
): Promise<ResultadoTicket> {
  const { actor, ticket } = await cargar(id);
  if (!ticket || !actor) return { ok: false, mensaje: "Ese ticket ya no existe." };

  if (!puedeInvitar(actor, ticket)) {
    return { ok: false, mensaje: "No puedes meter a nadie en este ticket." };
  }

  const pedidos = idsDeDiscord(identificadores);
  if (pedidos.length === 0) {
    return { ok: false, mensaje: "Pega uno o más identificadores de Discord." };
  }

  const encontrados = await db.user.findMany({
    where: { discordId: { in: pedidos } },
    select: { id: true, discordId: true },
  });

  const conocidos = new Set(encontrados.map((persona) => persona.discordId));
  const desconocidos = pedidos.filter((discordId) => !conocidos.has(discordId));
  if (desconocidos.length > 0) {
    return {
      ok: false,
      mensaje: `Estos no han entrado nunca en la web: ${desconocidos.join(", ")}.`,
    };
  }

  // El autor ya está dentro; volver a meterlo no es un error, se ignora.
  const nuevos = encontrados
    .map((persona) => persona.id)
    .filter((userId) => userId !== ticket.authorId);

  for (const userId of nuevos) {
    await db.ticketParticipant.upsert({
      where: { ticketId_userId: { ticketId: id, userId } },
      create: { ticketId: id, userId },
      update: {},
    });

    await crearAviso({
      userId,
      tipo: "TICKET",
      titulo: `Te han metido en el ticket #${ticket.numero}`,
      cuerpo: ticket.subject,
      url: `/tickets/${id}`,
    });
  }

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/panel/tickets/${id}`);
  emitirA([CANAL.ticket(id)]);

  return { ok: true, id };
}

/** Saca a alguien de la conversación. Al autor no se le puede sacar. */
export async function sacarDelTicket(
  id: string,
  userId: string,
): Promise<ResultadoTicket> {
  const { actor, ticket } = await cargar(id);
  if (!ticket || !actor) return { ok: false, mensaje: "Ese ticket ya no existe." };

  if (!puedeInvitar(actor, ticket)) {
    return { ok: false, mensaje: "No puedes tocar quién está en este ticket." };
  }

  await db.ticketParticipant
    .delete({ where: { ticketId_userId: { ticketId: id, userId } } })
    // Si ya no estaba, el resultado buscado se cumple igual.
    .catch(() => null);

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/panel/tickets/${id}`);
  emitirA([CANAL.ticket(id)]);

  return { ok: true, id };
}

/**
 * Deja constancia de que alguien tiene el ticket abierto.
 *
 * La llama la propia pantalla cada pocos segundos mientras esté a la vista. No
 * revalida nada: quien late ya está viendo la página, y los demás se enteran en
 * su siguiente refresco. Si revalidase, cada latido recargaría a todos.
 */
export async function marcarPresencia(id: string): Promise<void> {
  const { actor, ticket } = await cargar(id);
  if (!ticket || !actor || !puedeVer(actor, ticket)) return;

  const antes = await db.ticketPresence.findUnique({
    where: { ticketId_userId: { ticketId: id, userId: actor.id } },
    select: { seenAt: true },
  });

  await db.ticketPresence.upsert({
    where: { ticketId_userId: { ticketId: id, userId: actor.id } },
    create: { ticketId: id, userId: actor.id },
    update: { seenAt: new Date() },
  });

  // Solo se avisa cuando alguien aparece, no en cada latido: si no, los demás
  // estarían recargando la página cada veinte segundos por nada.
  if (!antes || !estaMirando(antes.seenAt)) emitirA([CANAL.ticket(id)]);

  // Y sus avisos de este ticket se dan por leídos: los está leyendo. Dejar la
  // campana en rojo mientras tienes la conversación abierta no dice nada.
  const leidos = await db.notification.updateMany({
    where: {
      userId: actor.id,
      readAt: null,
      OR: [{ url: `/tickets/${id}` }, { url: `/panel/tickets/${id}` }],
    },
    data: { readAt: new Date() },
  });

  if (leidos.count > 0) emitirA([CANAL.usuario(actor.id)]);
}

/**
 * Coge un ticket o lo suelta.
 *
 * No da exclusividad —cualquiera del escalón sigue pudiendo contestar— pero
 * dice quién está en ello, que es lo que evita que dos respondan lo mismo.
 */
export async function asignarTicket(
  id: string,
  aMi: boolean,
): Promise<ResultadoTicket> {
  const { actor, ticket } = await cargar(id);
  if (!ticket || !actor) return { ok: false, mensaje: "Ese ticket ya no existe." };

  if (!atiende(actor, ticket)) {
    return { ok: false, mensaje: "No atiendes este ticket." };
  }

  await db.ticket.update({
    where: { id },
    data: { assigneeId: aMi ? actor.id : null },
  });

  revalidatePath(`/panel/tickets/${id}`);
  revalidatePath("/panel/tickets");
  emitirA([CANAL.ticket(id), CANAL.panel()]);

  return { ok: true, id };
}

/**
 * Sube o baja el ticket de escalón.
 *
 * Al moverlo se suelta a quien lo llevaba: el nivel nuevo empieza de cero, y
 * dejar asignado a alguien que quizá ya ni lo ve solo confunde la bandeja.
 */
export async function moverTicket(
  id: string,
  destino: Role,
): Promise<ResultadoTicket> {
  const { usuario, actor, ticket } = await cargar(id);
  if (!ticket || !actor || !usuario) {
    return { ok: false, mensaje: "Ese ticket ya no existe." };
  }

  if (!puedeMover(actor, ticket, destino)) {
    return { ok: false, mensaje: "No puedes moverlo a ese escalón." };
  }

  await db.ticket.update({
    where: { id },
    data: {
      nivel: destino,
      status: "EN_CURSO",
      assigneeId: null,
      lastMessageAt: new Date(),
    },
  });

  await apuntar({
    accion: ACCIONES.TICKET,
    actor: usuario,
    objetivo: `#${ticket.numero} · ${ticket.subject}`,
    url: `/panel/tickets/${id}`,
    detalle: `${ticket.nivel} → ${destino}`,
  });

  await avisarAlStaff({
    tipo: "TICKET",
    titulo: `Ticket #${ticket.numero} escalado a ${destino.toLowerCase()}`,
    cuerpo: ticket.subject,
    url: `/panel/tickets/${id}`,
    desdeNivel: destino,
    excepto: actor.id,
  });

  revalidatePath(`/panel/tickets/${id}`);
  revalidatePath("/panel/tickets");
  emitirA([CANAL.ticket(id), CANAL.panel()]);

  return { ok: true, id };
}
