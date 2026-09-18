import type { NextConfig } from "next";
import { MAX_CUERPO_MB } from "./lib/limites";

/**
 * Cabeceras fijas. La política de contenido no está aquí: lleva un número que
 * cambia en cada respuesta, así que la escribe el middleware (ver proxy.ts).
 */
const CABECERAS = [
  // Un navegador que adivina el tipo de un fichero subido puede acabar
  // ejecutando como HTML algo que se guardó como imagen.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Al salir a otro sitio solo se cuenta el dominio, nunca la ruta: en esta web
  // las rutas llevan identificadores de tickets y de perfiles.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No se usan ninguna de las tres, así que se cierran a cal y canto.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Un año de HTTPS obligatorio. Solo lo aplican los navegadores cuando la
  // respuesta ya viaja cifrada, así que en local no estorba.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Salida autocontenida: la imagen de Docker no necesita el node_modules
  // completo para servir la web.
  output: "standalone",

  images: {
    // Los avatares de Discord son los únicos externos que servimos.
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },

  async headers() {
    return [{ source: "/:path*", headers: CABECERAS }];
  },

  experimental: {
    serverActions: {
      // Por defecto Next corta en 1 MB, muy por debajo de la tanda de fotos que
      // admite la galería: el corte pasaba antes de nuestra validación.
      bodySizeLimit: `${MAX_CUERPO_MB}mb`,
    },
  },
};

export default nextConfig;
