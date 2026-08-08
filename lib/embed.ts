/**
 * Forma y utilidades de los embeds de Discord.
 *
 * Vive aparte de `lib/discord.ts` porque ahí no hay nada de red: así los
 * constructores de mensajes se pueden probar sin arrastrar `server-only`.
 */

export type Embed = {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
};

export const EMBED_COLOR = {
  neutral: 0xffffff,
  pending: 0xf59e0b,
  accepted: 0x22c55e,
  rejected: 0xef4444,
} as const;

/** Recorta un valor para que quepa en un campo de embed (límite de Discord). */
export function clamp(value: string, max = 1000) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
