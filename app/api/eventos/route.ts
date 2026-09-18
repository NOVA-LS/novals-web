import { currentUser, isStaff } from "@/lib/guards";
import { db } from "@/lib/db";
import { CANAL, escuchar } from "@/lib/eventos";
import { puedeVer } from "@/lib/tickets/reglas";

export const dynamic = "force-dynamic";

/** Cada cuánto se manda un latido para que nadie corte la conexión por quieta. */
const LATIDO_MS = 25_000;

/**
 * Canal abierto por el que la web avisa de que algo ha cambiado.
 *
 * Es un flujo de eventos del servidor: la página lo deja abierto y, en cuanto
 * llega un aviso, vuelve a pedirse a sí misma. Sustituye a preguntar cada pocos
 * segundos por si acaso, que era lo que hacía que todo llegara tarde.
 *
 * Por aquí no viaja contenido, solo el nombre de lo que se movió. Quién puede
 * ver qué se decide igual que siempre, al pintar la página.
 */
export async function GET(peticion: Request) {
  const usuario = await currentUser();
  if (!usuario) return new Response(null, { status: 401 });

  const url = new URL(peticion.url);
  const ticketId = url.searchParams.get("ticket");

  const canales = [CANAL.usuario(usuario.id)];
  if (isStaff(usuario.role)) canales.push(CANAL.panel());
  // El foro lo lee cualquiera que haya entrado: no hay nada que reservar.
  if (url.searchParams.get("foro")) canales.push(CANAL.foro());

  // A un ticket solo se escucha si se puede leer: si no, el aviso contaría que
  // ahí dentro pasa algo a quien no debería saber ni que existe.
  if (ticketId) {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: {
        authorId: true,
        nivel: true,
        status: true,
        invitados: { select: { userId: true } },
      },
    });

    const puede =
      ticket !== null &&
      puedeVer(
        { id: usuario.id, role: usuario.role },
        { ...ticket, invitados: ticket.invitados.map((fila) => fila.userId) },
      );

    if (puede) canales.push(CANAL.ticket(ticketId));
  }

  const codificador = new TextEncoder();

  // Se declara antes del flujo porque `start` corre durante la construcción: si
  // viviera debajo, asignarla desde ahí daría con la variable sin inicializar.
  let cerrar: (() => void) | undefined;

  const flujo = new ReadableStream({
    start(control) {
      let vivo = true;

      function mandar(texto: string) {
        if (!vivo) return;
        try {
          control.enqueue(codificador.encode(texto));
        } catch {
          // El navegador ya cerró: la limpieza llega por `cancel`.
          vivo = false;
        }
      }

      // El primer mensaje abre la conexión de verdad: hasta que no llega algo,
      // el navegador no da por establecido el flujo.
      mandar(": hola\n\n");

      const bajas = canales.map((canal) =>
        escuchar(canal, () => mandar(`event: cambio\ndata: ${canal}\n\n`)),
      );

      // Un comentario cada tanto: sin tráfico, un proxy por medio cerraría la
      // conexión por inactividad y el navegador tendría que reconectar.
      const latido = setInterval(() => mandar(": latido\n\n"), LATIDO_MS);

      cerrar = () => {
        vivo = false;
        clearInterval(latido);
        for (const baja of bajas) baja();
      };
    },

    cancel() {
      cerrar?.();
    },
  });

  return new Response(flujo, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx guarda la respuesta entera antes de mandarla si no se le dice
      // que no: con eso, un flujo continuo no llega nunca.
      "X-Accel-Buffering": "no",
    },
  });
}
