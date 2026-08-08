import { EQUIPOS } from "@/lib/equipos";
import { ESCALONES } from "@/lib/roles";
import type { Role, StaffTag } from "@/generated/prisma/enums";

/**
 * Correspondencia entre los roles de la web y los de Discord.
 *
 * Los identificadores no se escriben en el código: cambian de un servidor a
 * otro y no son secretos, pero tampoco son cosa del repositorio. Se leen del
 * entorno, y lo que no esté configurado simplemente no se sincroniza.
 *
 * Módulo puro: no llama a Discord ni a la base de datos, solo decide qué habría
 * que poner y qué quitar. Así se puede probar entero sin red.
 */

export type MapaDiscord = {
  /** Escalón de staff → identificador del rol en Discord. */
  roles: Partial<Record<Role, string>>;
  /** Equipo → identificador del rol en Discord. */
  equipos: Partial<Record<StaffTag, string>>;
  /** El rol de quien puede jugar. No es staff ni equipo: es la entrada. */
  whitelist?: string;
};

type Entorno = Record<string, string | undefined>;

/**
 * Lee el mapa del entorno.
 *
 * Nombres: `DISCORD_ROL_MODERADOR`, `DISCORD_EQUIPO_DEV`. Lo que falte se queda
 * fuera del mapa, y lo que está fuera del mapa no se toca en Discord: un rol de
 * la comunidad que no conocemos no debe desaparecer porque alguien cambie de
 * escalón en la web.
 */
export function leerMapa(entorno: Entorno = process.env): MapaDiscord {
  const roles: Partial<Record<Role, string>> = {};
  for (const escalon of ESCALONES) {
    const id = entorno[`DISCORD_ROL_${escalon}`]?.trim();
    if (id) roles[escalon] = id;
  }

  const equipos: Partial<Record<StaffTag, string>> = {};
  for (const equipo of EQUIPOS) {
    const id = entorno[`DISCORD_EQUIPO_${equipo}`]?.trim();
    if (id) equipos[equipo] = id;
  }

  const whitelist = entorno.DISCORD_ROL_WHITELIST?.trim();

  return { roles, equipos, ...(whitelist ? { whitelist } : {}) };
}

/** Si hay algo configurado con lo que sincronizar. */
export function hayMapa(mapa: MapaDiscord): boolean {
  return (
    Object.keys(mapa.roles).length > 0 ||
    Object.keys(mapa.equipos).length > 0 ||
    mapa.whitelist !== undefined
  );
}

/**
 * Qué escalón le toca a alguien según los roles que lleva en Discord.
 *
 * Si lleva varios —pasa: se asciende sin quitar el anterior— manda el más alto.
 * Sin ninguno de los nuestros, es un jugador.
 */
export function rolDesdeDiscord(
  rolesDelMiembro: string[],
  mapa: MapaDiscord,
): Role {
  const suyos = new Set(rolesDelMiembro);

  // ESCALONES va de menor a mayor, así que el último que cumpla es el más alto.
  let resultado: Role = "USER";
  for (const escalon of ESCALONES) {
    const id = mapa.roles[escalon];
    if (id && suyos.has(id)) resultado = escalon;
  }

  return resultado;
}

/** Qué equipos lleva según Discord. Se pueden llevar varios a la vez. */
export function equiposDesdeDiscord(
  rolesDelMiembro: string[],
  mapa: MapaDiscord,
): StaffTag[] {
  const suyos = new Set(rolesDelMiembro);

  return EQUIPOS.filter((equipo) => {
    const id = mapa.equipos[equipo];
    return id !== undefined && suyos.has(id);
  });
}

/** Si según Discord tiene la entrada a la ciudad. */
export function whitelistDesdeDiscord(
  rolesDelMiembro: string[],
  mapa: MapaDiscord,
): boolean {
  return mapa.whitelist !== undefined && rolesDelMiembro.includes(mapa.whitelist);
}

export type CambiosDiscord = { poner: string[]; quitar: string[] };

/**
 * Qué hay que tocar en Discord para que refleje lo que dice la web.
 *
 * Solo se mueven identificadores que estén en el mapa. Todo lo demás que lleve
 * esa persona —roles de facción, de color, de lo que sea— se queda intacto.
 */
export function cambiosParaDiscord({
  rol,
  equipos,
  whitelist = false,
  rolesDelMiembro,
  mapa,
}: {
  rol: Role;
  equipos: StaffTag[];
  whitelist?: boolean;
  rolesDelMiembro: string[];
  mapa: MapaDiscord;
}): CambiosDiscord {
  const suyos = new Set(rolesDelMiembro);
  const poner: string[] = [];
  const quitar: string[] = [];

  const debe = new Set<string>();
  const nuestro = new Set<string>();

  for (const escalon of ESCALONES) {
    const id = mapa.roles[escalon];
    if (!id) continue;
    nuestro.add(id);
    if (escalon === rol) debe.add(id);
  }

  for (const nombre of EQUIPOS) {
    const id = mapa.equipos[nombre];
    if (!id) continue;
    nuestro.add(id);
    if (equipos.includes(nombre)) debe.add(id);
  }

  if (mapa.whitelist) {
    nuestro.add(mapa.whitelist);
    if (whitelist) debe.add(mapa.whitelist);
  }

  for (const id of debe) {
    if (!suyos.has(id)) poner.push(id);
  }

  for (const id of nuestro) {
    if (!debe.has(id) && suyos.has(id)) quitar.push(id);
  }

  return { poner, quitar };
}
