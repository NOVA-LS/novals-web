import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { traerDeDiscordPorDiscordId } from "@/lib/discord/sincronizar";

/**
 * Aviso de que a alguien le han cambiado los roles en Discord.
 *
 * La web no tiene bot conectado al gateway, así que no se entera sola de lo que
 * pasa allí: al entrar a la web se recogen los roles, y esta ruta permite que un
 * bot externo lo cuente en el momento, escuchando `guildMemberUpdate`.
 *
 * Se llama así:
 *
 *   POST /api/discord/sync
 *   Authorization: Bearer <DISCORD_SYNC_SECRET>
 *   { "discordId": "123456789012345678" }
 */
export async function POST(peticion: Request) {
  const secreto = process.env.DISCORD_SYNC_SECRET?.trim();
  // Sin secreto configurado la ruta no existe: mejor eso que abierta de par en par.
  if (!secreto) return new NextResponse(null, { status: 404 });

  const enviado = peticion.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!enviado || !igual(enviado, secreto)) {
    return new NextResponse(null, { status: 401 });
  }

  let discordId: unknown;
  try {
    ({ discordId } = (await peticion.json()) as { discordId?: unknown });
  } catch {
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  if (typeof discordId !== "string" || !/^\d{5,}$/.test(discordId)) {
    return NextResponse.json({ error: "Falta discordId" }, { status: 400 });
  }

  const cambio = await traerDeDiscordPorDiscordId(discordId);

  return NextResponse.json({ ok: true, cambio });
}

/** Comparación de secretos sin filtrar por dónde dejan de parecerse. */
function igual(a: string, b: string) {
  const uno = Buffer.from(a);
  const otro = Buffer.from(b);
  if (uno.length !== otro.length) return false;
  return timingSafeEqual(uno, otro);
}
