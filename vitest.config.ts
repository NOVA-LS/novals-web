import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` existe para que un módulo del servidor no acabe en el
      // navegador: al importarse fuera de un componente de servidor, revienta a
      // propósito. Aquí ya estamos en Node, así que se cambia por nada y se
      // pueden probar los módulos que lo llevan.
      "server-only": fileURLToPath(new URL("./tests/nada.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
