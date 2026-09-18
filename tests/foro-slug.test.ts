import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { conSlugLibre } from "@/lib/foro/slug";

/** El error que tira SQLite cuando dos filas compiten por el mismo slug. */
function colisionDeSlug() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`slug`)",
    { code: "P2002", clientVersion: "test", meta: { target: ["slug"] } },
  );
}

describe("conSlugLibre", () => {
  it("usa el slug base cuando está libre", async () => {
    const creado = await conSlugLibre(
      "Bienvenidos al foro",
      "hilo",
      async () => true,
      async (slug) => slug,
    );

    expect(creado).toBe("bienvenidos-al-foro");
  });

  it("prueba el siguiente sufijo cuando el candidato ya existe", async () => {
    const ocupados = new Set(["hola", "hola-2"]);

    const creado = await conSlugLibre(
      "Hola",
      "hilo",
      async (slug) => !ocupados.has(slug),
      async (slug) => slug,
    );

    expect(creado).toBe("hola-3");
  });

  it("reintenta cuando dos peticiones ganan la misma comprobación a la vez", async () => {
    // Las dos ven "hola" libre antes de que ninguna haya creado nada —la
    // carrera real que provoca el 500 sin capturar—: la comprobación dice
    // que sí, pero crear falla porque otra ya se adelantó.
    let primerIntento = true;

    const creado = await conSlugLibre(
      "Hola",
      "hilo",
      async () => true,
      async (slug) => {
        if (primerIntento) {
          primerIntento = false;
          throw colisionDeSlug();
        }
        return slug;
      },
    );

    expect(creado).toBe("hola-2");
  });

  it("no traga un error que no es de slug repetido", async () => {
    await expect(
      conSlugLibre(
        "Hola",
        "hilo",
        async () => true,
        async () => {
          throw new Error("La base de datos no responde");
        },
      ),
    ).rejects.toThrow("La base de datos no responde");
  });

  it("cae al respaldo cuando el título no da ninguna letra", async () => {
    const creado = await conSlugLibre(
      "···",
      "hilo",
      async () => true,
      async (slug) => slug,
    );

    expect(creado).toBe("hilo");
  });
});
