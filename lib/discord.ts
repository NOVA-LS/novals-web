import "server-only";
import type { Embed } from "@/lib/embed";

const API = "https://discord.com/api/v10";

/**
 * Códigos con los que Discord rechaza un privado por decisión del destinatario,
 * no por un fallo nuestro: 50007 son los privados cerrados y 50278 es no
 * compartir ningún servidor con el bot. Reintentar no arregla ninguno de los dos.
 */
const SIN_PERMISO_PARA_ESCRIBIR = new Set([50007, 50278]);

/**
 * Avisa al canal de staff. Nunca lanza: un webhook caído no debe tumbar el
 * envío de una solicitud, así que el fallo solo se registra.
 */
export async function notifyStaff(embed: Embed): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ timestamp: new Date().toISOString(), ...embed }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(
        `Webhook de Discord respondió ${response.status}: ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error("No se pudo avisar al Discord de staff", error);
  }
}

export type ResultadoDM =
  | { ok: true }
  | { ok: false; motivo: "SIN_TOKEN" | "BLOQUEADO" | "ERROR"; detalle?: string };

/**
 * Escribe un mensaje directo a un usuario de Discord.
 *
 * Son dos llamadas: abrir (o recuperar) el canal privado con esa persona y
 * publicar en él. No hay bot conectado al gateway; basta con que el bot esté
 * dentro del servidor de la comunidad, porque Discord no deja escribir a quien
 * no comparte servidor contigo.
 *
 * Nunca lanza: devuelve el motivo para que quien llama decida el fallback.
 */
export async function enviarDM(
  discordId: string,
  embed: Embed,
): Promise<ResultadoDM> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false, motivo: "SIN_TOKEN" };

  const cabeceras = {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const canal = await fetch(`${API}/users/@me/channels`, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify({ recipient_id: discordId }),
      signal: AbortSignal.timeout(5000),
    });

    if (!canal.ok) {
      return await fallo(canal, "No se pudo abrir el privado");
    }

    const { id } = (await canal.json()) as { id: string };

    const mensaje = await fetch(`${API}/channels/${id}/messages`, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify({
        embeds: [{ timestamp: new Date().toISOString(), ...embed }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!mensaje.ok) {
      return await fallo(mensaje, "No se pudo enviar el privado");
    }

    return { ok: true };
  } catch (error) {
    console.error("Fallo de red al enviar un privado de Discord", error);
    return { ok: false, motivo: "ERROR", detalle: "No respondió Discord." };
  }
}

/** Traduce una respuesta de error de Discord al resultado que espera quien llama. */
async function fallo(response: Response, contexto: string): Promise<ResultadoDM> {
  const cuerpo = await response.text();
  let codigo: number | undefined;

  try {
    codigo = (JSON.parse(cuerpo) as { code?: number }).code;
  } catch {
    // Discord no siempre responde JSON (por ejemplo, ante un 502 de su CDN).
  }

  if (codigo !== undefined && SIN_PERMISO_PARA_ESCRIBIR.has(codigo)) {
    return { ok: false, motivo: "BLOQUEADO" };
  }

  console.error(`${contexto}: ${response.status} ${cuerpo}`);
  return { ok: false, motivo: "ERROR", detalle: `HTTP ${response.status}` };
}


/**
 * Estado de alguien respecto al servidor.
 *
 * «Fuera» y «no se sabe» tienen que distinguirse: que alguien se haya ido del
 * Discord es motivo para quitarle el staff en la web, pero que Discord no
 * responda no lo es.
 */
export type MiembroDiscord =
  | { estado: "dentro"; roles: string[] }
  | { estado: "fuera" }
  | { estado: "desconocido" };

/** El servidor de la comunidad. Sin él no hay nada que sincronizar. */
function guild() {
  return process.env.DISCORD_GUILD_ID?.trim();
}

function cabeceras(token: string) {
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

/** Lee un miembro del servidor: lo que interesa es qué roles lleva puestos. */
export async function miembroDeGuild(
  discordId: string,
): Promise<MiembroDiscord> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const servidor = guild();
  if (!token || !servidor) return { estado: "desconocido" };

  try {
    const respuesta = await fetch(
      `${API}/guilds/${servidor}/members/${discordId}`,
      { headers: cabeceras(token), signal: AbortSignal.timeout(5000) },
    );

    // 404 es lo normal cuando alguien entró a la web pero se fue del Discord.
    if (respuesta.status === 404) return { estado: "fuera" };
    if (!respuesta.ok) {
      console.error(
        `No se pudo leer el miembro ${discordId}: ${respuesta.status} ${await respuesta.text()}`,
      );
      return { estado: "desconocido" };
    }

    const cuerpo = (await respuesta.json()) as { roles?: string[] };
    return { estado: "dentro", roles: cuerpo.roles ?? [] };
  } catch (error) {
    console.error("Fallo de red al leer un miembro de Discord", error);
    return { estado: "desconocido" };
  }
}

/**
 * Pone o quita un rol.
 *
 * Nunca lanza. El fallo más habitual es un 403: el bot necesita el permiso de
 * gestionar roles y, además, tener su propio rol por encima del que toca.
 */
export async function cambiarRolDiscord(
  discordId: string,
  roleId: string,
  accion: "poner" | "quitar",
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const servidor = guild();
  if (!token || !servidor) return false;

  try {
    const respuesta = await fetch(
      `${API}/guilds/${servidor}/members/${discordId}/roles/${roleId}`,
      {
        method: accion === "poner" ? "PUT" : "DELETE",
        headers: cabeceras(token),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!respuesta.ok) {
      console.error(
        `No se pudo ${accion} el rol ${roleId} a ${discordId}: ` +
          `${respuesta.status} ${await respuesta.text()}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Fallo de red al ${accion} un rol de Discord`, error);
    return false;
  }
}
