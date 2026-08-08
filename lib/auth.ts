import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { traerDeDiscord } from "./discord/sincronizar";
import { referidoDeLaCookie } from "./invitaciones";

/** Cada cuánto se vuelve a mirar en la base qué rol tiene quien navega. */
const REFRESCO_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, profile, trigger }) {
      // En el login guardamos o actualizamos el usuario con los datos de Discord.
      if (profile?.id) {
        const discordId = String(profile.id);
        const username =
          (profile.global_name as string | undefined) ??
          (profile.username as string | undefined) ??
          "sin nombre";
        const avatar = (profile.image_url as string | undefined) ?? null;

        // No se usa upsert: hace falta saber si la cuenta es nueva para
        // decidir si se le atribuye la invitación, y un upsert no lo dice.
        const existente = await db.user.findUnique({ where: { discordId } });
        const user = existente
          ? await db.user.update({
              where: { discordId },
              data: { username, avatar },
            })
          : await db.user.create({
              data: {
                discordId,
                username,
                avatar,
                referredById: await referidoDeLaCookie(),
              },
            });

        // Al entrar se recogen los roles que tenga en Discord: es donde el
        // staff se asciende de verdad, y así no hay que tocarlo en dos sitios.
        const traido = await traerDeDiscord(user.id);

        token.uid = user.id;
        token.role = traido?.rol?.ahora ?? user.role;
        token.discordId = user.discordId;
        token.visto = Date.now();
      }

      // El rol del token decide si el filtro de rutas deja pasar al panel, y ese
      // token se emitió al entrar: sin esto, ascender a alguien no servía de nada
      // hasta que cerrara sesión y volviera. Se relee cada poco, no en cada
      // petición, para no consultar la base en cada navegación.
      const caducado =
        typeof token.visto !== "number" || Date.now() - token.visto > REFRESCO_MS;

      if (token.uid && (trigger === "update" || caducado)) {
        const user = await db.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true },
        });
        if (user) token.role = user.role;
        token.visto = Date.now();
      }

      return token;
    },

    // session() se hereda de authConfig: la comparten servidor y middleware.
  },
});
