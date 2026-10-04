/**
 * Menciones a roles en el mensaje del canal.
 *
 * Módulo puro, como `canales.ts`: no llama a Discord, solo decide qué roles se
 * ofrecen y qué cuerpo se manda. Así se prueba sin red.
 */

export type RolDiscord = {
  id: string;
  name: string;
  position: number;
  /** Roles que gestiona una integración (el propio bot, por ejemplo): nadie
   * los tiene asignado a mano, mencionarlos no avisa a nadie. */
  managed: boolean;
};

/**
 * Los roles que tiene sentido ofrecer en el desplegable, los más altos de la
 * jerarquía primero. Fuera `@everyone`, cuyo id es el del propio servidor, y
 * los gestionados por integraciones.
 */
export function rolesMencionables(roles: RolDiscord[], servidorId: string | undefined): RolDiscord[] {
  return roles
    .filter((rol) => rol.id !== servidorId && !rol.managed)
    .sort((a, b) => b.position - a.position);
}

/** Un id de Discord es un entero largo: cualquier otra cosa no es un rol. */
const ID_DISCORD = /^\d{5,25}$/;

/**
 * La mención que va debajo del anuncio, tapada con un spoiler (`||…||`): sigue
 * notificando, pero no se ve el `@rol` suelto. `null` si no hay rol o lo que
 * llega no es un id de Discord.
 */
export function mencionTapada(rolId?: string | null): string | null {
  return rolId && ID_DISCORD.test(rolId) ? `||<@&${rolId}>||` : null;
}
