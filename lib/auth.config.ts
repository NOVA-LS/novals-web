import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Configuración sin acceso a base de datos: la usa el middleware, que corre en
 * el runtime edge y no puede cargar Prisma. La versión completa está en auth.ts.
 */
export const authConfig = {
  providers: [Discord],
  pages: {
    signIn: "/entrar",
    error: "/entrar",
  },
  callbacks: {
    // Este callback vive aquí, y no solo en auth.ts, porque el middleware
    // construye su sesión con esta configuración: sin él, session.user.role
    // llega vacío en el edge y authorized() deniega el panel a un ADMIN.
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.role) session.user.role = token.role as typeof session.user.role;
      if (token.discordId) session.user.discordId = token.discordId as string;
      return session;
    },

  },
} satisfies NextAuthConfig;
