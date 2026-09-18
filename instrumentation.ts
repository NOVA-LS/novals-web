export async function register() {
  // El runtime edge (middleware) también ejecuta este gancho y ahí no hay
  // WebSocket de larga vida que sostener.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { conectarPresencia } = await import("@/lib/discord-presence");
  conectarPresencia();
}
