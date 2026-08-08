import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COOKIE_REF } from "@/lib/invitaciones";

export const dynamic = "force-dynamic";

const TREINTA_DIAS = 60 * 60 * 24 * 30;

/**
 * Enlace de invitación de un usuario: `/r/{su id}`.
 *
 * Deja una cookie con quién invitó y manda a inicio. El alta de cuenta la lee
 * al crearse (lib/invitaciones.ts) — aquí no se toca la sesión ni se exige
 * estar identificado, porque quien llega por este enlace normalmente no tiene
 * cuenta todavía.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const destino = new URL("/", _peticion.url);

  const existe = await db.user.findUnique({
    where: { id: codigo },
    select: { id: true },
  });
  if (!existe) return NextResponse.redirect(destino);

  const respuesta = NextResponse.redirect(destino);
  respuesta.cookies.set(COOKIE_REF, codigo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TREINTA_DIAS,
    path: "/",
  });
  return respuesta;
}
