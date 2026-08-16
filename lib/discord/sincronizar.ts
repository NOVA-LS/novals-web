import "server-only";
import { db } from "@/lib/db";
import { cambiarRolDiscord, miembroDeGuild } from "@/lib/discord";
import {
  cambiosParaDiscord,
  equiposDesdeDiscord,
  hayMapa,
  leerMapa,
  rolDesdeDiscord,
  whitelistDesdeDiscord,
} from "@/lib/discord/roles";
import { sincronizarInsignias } from "@/lib/insignias/sincronizar";
import { sincronizarSiInvitado } from "@/lib/invitaciones";
import { CANAL, emitirA } from "@/lib/eventos";
import { enLotes } from "@/lib/concurrencia";
import type { Role, StaffTag } from "@/generated/prisma/enums";

/**
 * Los roles de la web y los de Discord, en los dos sentidos.
 *
 * La web manda cuando se toca desde el panel: se cambia aquí y se refleja allí.
 * Discord manda cuando se toca allí: se recoge al entrar a la web, o cuando lo
 * pide el panel, o cuando un bot avisa por la ruta de sincronización.
 *
 * Nada de esto lanza. Un Discord caído o mal configurado no puede impedir que se
 * ascienda a alguien en la web; lo que quede desalineado se arregla en el
 * siguiente repaso.
 */

/** Lleva a Discord el rol y el equipo que dice la web. */
export async function empujarADiscord(userId: string): Promise<void> {
  const mapa = leerMapa();
  if (!hayMapa(mapa)) return;

  try {
    const usuario = await db.user.findUnique({
      where: { id: userId },
      select: {
        discordId: true,
        role: true,
        whitelisted: true,
        teams: { select: { tag: true } },
      },
    });
    if (!usuario) return;

    const miembro = await miembroDeGuild(usuario.discordId);
    // Quien no está en el servidor no tiene roles que cambiar.
    if (miembro.estado !== "dentro") return;

    const { poner, quitar } = cambiosParaDiscord({
      rol: usuario.role,
      equipos: usuario.teams.map((fila) => fila.tag),
      whitelist: usuario.whitelisted,
      rolesDelMiembro: miembro.roles,
      mapa,
    });

    for (const roleId of quitar) {
      await cambiarRolDiscord(usuario.discordId, roleId, "quitar");
    }
    for (const roleId of poner) {
      await cambiarRolDiscord(usuario.discordId, roleId, "poner");
    }
  } catch (error) {
    console.error("No se pudieron empujar los roles a Discord", error);
  }
}

export type CambioTraido = {
  rol?: { antes: Role; ahora: Role };
  equipos?: { antes: StaffTag[]; ahora: StaffTag[] };
  whitelist?: { antes: boolean; ahora: boolean };
};

/**
 * Trae de Discord el rol y el equipo, y los guarda si cambian.
 *
 * Discord es la fuente cuando se pregunta: si a alguien le quitaron el rol allí,
 * aquí deja de ser staff. Devuelve qué cambió, o `null` si no cambió nada.
 */
export async function traerDeDiscord(userId: string): Promise<CambioTraido | null> {
  const mapa = leerMapa();
  if (!hayMapa(mapa)) return null;

  try {
    const usuario = await db.user.findUnique({
      where: { id: userId },
      select: {
        discordId: true,
        role: true,
        whitelisted: true,
        teams: { select: { tag: true } },
      },
    });
    if (!usuario) return null;

    const miembro = await miembroDeGuild(usuario.discordId);
    // Que Discord no conteste no puede degradar a nadie: se deja como está.
    if (miembro.estado === "desconocido") return null;

    // Irse del Discord sí: quien ya no está en el servidor no es staff de la
    // ciudad, y dejarle el panel abierto sería lo peor de los dos mundos.
    const suyos = miembro.estado === "dentro" ? miembro.roles : [];
    const rol = rolDesdeDiscord(suyos, mapa);
    const equipos = equiposDesdeDiscord(suyos, mapa);
    const tenia = usuario.teams.map((fila) => fila.tag);
    const whitelist = whitelistDesdeDiscord(suyos, mapa);

    const cambio: CambioTraido = {};
    // Los escalones que no estén configurados no pueden decidir nada: sin su
    // identificador, Discord diría «este no es staff» de alguien que sí lo es.
    if (mapa.roles[usuario.role] !== undefined || usuario.role === "USER") {
      if (rol !== usuario.role) cambio.rol = { antes: usuario.role, ahora: rol };
    }
    if (!mismosEquipos(tenia, equipos)) {
      cambio.equipos = { antes: tenia, ahora: equipos };
    }
    // Sin rol de whitelist configurado, Discord no opina: quitarla porque no
    // encontramos un identificador dejaría a media ciudad sin poder escribir.
    if (mapa.whitelist !== undefined && whitelist !== usuario.whitelisted) {
      cambio.whitelist = { antes: usuario.whitelisted, ahora: whitelist };
    }

    if (!cambio.rol && !cambio.equipos && !cambio.whitelist) return null;

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          ...(cambio.rol ? { role: cambio.rol.ahora } : {}),
          ...(cambio.whitelist ? { whitelisted: cambio.whitelist.ahora } : {}),
        },
      }),
      // Los equipos se reescriben enteros: es más simple que calcular altas y
      // bajas, y son cuatro filas por persona como mucho.
      ...(cambio.equipos
        ? [
            db.userTeam.deleteMany({ where: { userId } }),
            db.userTeam.createMany({
              data: cambio.equipos.ahora.map((tag) => ({ userId, tag })),
            }),
          ]
        : []),
    ]);

    // Entrar en el staff o pasar la whitelist mueve las insignias.
    if (cambio.rol || cambio.whitelist) await sincronizarInsignias(userId);
    // Y si pasó la whitelist y le trajo alguien, también las suyas.
    if (cambio.whitelist?.ahora) await sincronizarSiInvitado(userId);

    emitirA([CANAL.usuario(userId), CANAL.panel()]);

    return cambio;
  } catch (error) {
    console.error("No se pudieron traer los roles de Discord", error);
    return null;
  }
}

/** Dos listas de equipos son la misma si tienen lo mismo, en cualquier orden. */
function mismosEquipos(a: StaffTag[], b: StaffTag[]) {
  if (a.length !== b.length) return false;
  const suyos = new Set(a);
  return b.every((equipo) => suyos.has(equipo));
}

/** Cuántos a la vez en un repaso masivo: ni todos juntos ni uno a uno. */
const LOTE = 5;

/** Repasa a todo el mundo contra Discord. Devuelve a cuántos les cambió algo. */
export async function traerDeDiscordATodos(): Promise<number> {
  const mapa = leerMapa();
  if (!hayMapa(mapa)) return 0;

  const usuarios = await db.user.findMany({ select: { id: true } });

  const cambios = await enLotes(usuarios, LOTE, (usuario) => traerDeDiscord(usuario.id));
  return cambios.filter(Boolean).length;
}

/** Como `traerDeDiscord`, pero buscando por identificador de Discord. */
export async function traerDeDiscordPorDiscordId(
  discordId: string,
): Promise<CambioTraido | null> {
  const usuario = await db.user.findUnique({
    where: { discordId },
    select: { id: true },
  });
  if (!usuario) return null;

  return traerDeDiscord(usuario.id);
}
