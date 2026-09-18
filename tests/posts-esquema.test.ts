import { describe, expect, it } from "vitest";
import { esquemaNoticia } from "@/lib/noticias";

const BASE = {
  title: "Título de sobra",
  excerpt: "Una entradilla que cumple el mínimo de caracteres.",
  contentMd: "Contenido de sobra para pasar la validación mínima.",
};

describe("esquemaNoticia", () => {
  it("exige canal cuando se publica", () => {
    const resultado = esquemaNoticia.safeParse({ ...BASE, published: true, channelId: "" });
    expect(resultado.success).toBe(false);
  });

  it("deja publicar con canal elegido", () => {
    const resultado = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      channelId: "123456789",
    });
    expect(resultado.success).toBe(true);
  });

  it("en borrador no hace falta canal", () => {
    const resultado = esquemaNoticia.safeParse({ ...BASE, published: false, channelId: "" });
    expect(resultado.success).toBe(true);
  });
});
