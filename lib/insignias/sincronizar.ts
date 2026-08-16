import "server-only";
import { db } from "@/lib/db";
import { diasDesde } from "@/lib/stats";
import { crearAviso } from "@/lib/avisos";
import { enLotes } from "@/lib/concurrencia";
import {
  getInsignia,
  insigniasPendientes,
  type MetricasJugador,
} from "@/lib/insignias/catalogo";

/**
 * Reparto automático de insignias.
 *
 * Se llama después de cualquier cosa que pueda haber cambiado las cuentas de
 * alguien: escribir en el foro, resolverle una solicitud, cerrarle un ticket o
 * cambiarle el rol. Mira qué le corresponde, le da lo que le falte y se lo dice.
 *
 * Nunca quita nada. Una insignia ganada es algo que pasó; que después se borre
 * un mensaje no lo deshace.
 */

/** Las cuentas de un jugador, tal como las pide el catálogo. */
export async function metricasDe(userId: string): Promise<MetricasJugador | null> {
  const usuario = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, role: true, whitelisted: true },
  });
  if (!usuario) return null;

  const [mensajes, hilos, invitadosConWhitelist] = await Promise.all([
    db.reply.count({ where: { authorId: userId } }),
    db.thread.count({ where: { authorId: userId } }),
    db.user.count({ where: { referredById: userId, whitelisted: true } }),
  ]);

  return {
    diasDeCuenta: diasDesde(usuario.createdAt),
    mensajes,
    hilos,
    tieneWhitelist: usuario.whitelisted,
    esStaff: usuario.role !== "USER",
    invitadosConWhitelist,
  };
}

/**
 * Sincronizaciones en marcha, por usuario.
 *
 * Escribir un mensaje y que a la vez le sincronicen el rol desde Discord
 * dispara dos repasos de sus cuentas casi a la par; sin esto, cada uno vuelve
 * a contar mensajes e hilos desde cero por su lado. Mientras uno está en
 * marcha, el que llega detrás espera el mismo en vez de arrancar el suyo.
 */
const enCurso = new Map<string, Promise<string[]>>();

/**
 * Pone al día las insignias de una persona. Devuelve las que ha ganado ahora.
 *
 * No lanza: se llama colgada del final de otras acciones —responder un hilo,
 * cerrar un ticket— y ninguna de ellas puede caerse porque falle un reparto.
 */
export function sincronizarInsignias(userId: string): Promise<string[]> {
  const yaEnCurso = enCurso.get(userId);
  if (yaEnCurso) return yaEnCurso;

  const tarea = ejecutar(userId).finally(() => enCurso.delete(userId));
  enCurso.set(userId, tarea);
  return tarea;
}

async function ejecutar(userId: string): Promise<string[]> {
  try {
    const metricas = await metricasDe(userId);
    if (!metricas) return [];

    const actuales = await db.userBadge.findMany({
      where: { userId },
      select: { slug: true },
    });

    const nuevas = insigniasPendientes(
      metricas,
      actuales.map((fila) => fila.slug),
    );
    if (nuevas.length === 0) return [];

    for (const slug of nuevas) {
      const insignia = getInsignia(slug);
      if (!insignia) continue;

      // Upsert y no create: dos acciones a la vez podrían intentar darle la
      // misma insignia, y la segunda no debe reventar por la clave repetida.
      // (SQLite no admite `skipDuplicates` en createMany.)
      await db.userBadge.upsert({
        where: { userId_slug: { userId, slug } },
        create: { userId, slug },
        update: {},
      });

      await crearAviso({
        userId,
        tipo: "INSIGNIA",
        titulo: `Has ganado «${insignia.nombre}»`,
        cuerpo: insignia.descripcion,
        url: `/u/${userId}`,
      });
    }

    return nuevas;
  } catch (error) {
    console.error("No se pudieron repartir las insignias", error);
    return [];
  }
}

/**
 * Repasa a todo el mundo. Es lo que se pulsa desde el panel al añadir una
 * insignia nueva al catálogo: sin esto, solo la ganaría quien hiciera algo
 * después.
 */
export async function sincronizarATodos(): Promise<number> {
  const usuarios = await db.user.findMany({ select: { id: true } });

  const repartidas = await enLotes(usuarios, 5, (usuario) =>
    sincronizarInsignias(usuario.id),
  );
  return repartidas.reduce((total, nuevas) => total + nuevas.length, 0);
}
