import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Cabeceras de seguridad y filtro de rutas.
 *
 * La política de contenido se escribe aquí y no en `next.config.ts` porque lleva
 * un número de un solo uso: el navegador ejecuta un script si —y solo si— trae
 * ese número, que cambia en cada respuesta. Un `<script>` que se colara por el
 * texto de un mensaje no puede adivinarlo, así que no llega a ejecutarse.
 *
 * `strict-dynamic` deja que los scripts de Next carguen a los suyos sin repetir
 * el número en cada uno. En los navegadores que lo entienden hace que se ignore
 * `'self'` y `'unsafe-inline'`; los dos se dejan puestos solo para los viejos,
 * que no entienden ni el número ni `strict-dynamic`.
 */
const enDesarrollo = process.env.NODE_ENV !== "production";

function politica(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${
      // El modo desarrollo compila en el navegador; el build no.
      enDesarrollo ? " 'unsafe-eval'" : ""
    }`,
    // Next escribe estilos en línea al hidratar, así que aquí no hay número que
    // valga: es lo único que queda abierto de la política.
    "style-src 'self' 'unsafe-inline'",
    // Los retratos salen de Discord; el resto de imágenes, de casa.
    "img-src 'self' data: blob: https://cdn.discordapp.com",
    "font-src 'self' data:",
    // Lo único que sale de aquí es el canal de eventos, del propio dominio.
    "connect-src 'self'",
  ].join("; ");
}

export default auth((peticion) => {
  const { pathname } = peticion.nextUrl;

  // Sin sesión no se entra a lo privado. El rol no se mira aquí: lo decide el
  // servidor leyendo la base, que es lo único al día (ver lib/guards.ts).
  if (
    !peticion.auth &&
    (pathname.startsWith("/panel") || pathname.startsWith("/perfil"))
  ) {
    const entrar = new URL("/entrar", peticion.nextUrl);
    entrar.searchParams.set("callbackUrl", peticion.nextUrl.href);
    return NextResponse.redirect(entrar);
  }

  const nonce = crypto.randomUUID();
  const csp = politica(nonce);

  // El número viaja también en la petición: es de ahí de donde lo lee Next para
  // ponérselo a sus propios scripts.
  const cabeceras = new Headers(peticion.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);

  return respuesta;
});

export const config = {
  /**
   * Todo salvo lo que no es una página: los ficheros del build, las imágenes
   * optimizadas y las rutas de API. El canal de eventos queda fuera a propósito
   * —es un flujo que se queda abierto y no debe pasar por aquí— y la política no
   * le hace falta: nadie ejecuta un flujo de texto.
   */
  matcher: ["/((?!api|_next/static|_next/image|.*\\.).*)"],
};
