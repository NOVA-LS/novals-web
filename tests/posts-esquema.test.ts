import { describe, expect, it } from "vitest";
import { esquemaNoticia } from "@/lib/noticias";

const BASE = {
  title: "Título de sobra",
  excerpt: "Una entradilla que cumple el mínimo de caracteres.",
  contentMd: "Contenido de sobra para pasar la validación mínima.",
  notificarPrivado: false,
};

describe("esquemaNoticia", () => {
  it("deja publicar sin canal", () => {
    const resultado = esquemaNoticia.safeParse({ ...BASE, published: true, channelId: "" });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.channelId).toBeUndefined();
  });

  it("deja publicar con canal elegido", () => {
    const resultado = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      channelId: "123456789",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.channelId).toBe("123456789");
  });

  it("en borrador tampoco hace falta canal", () => {
    const resultado = esquemaNoticia.safeParse({ ...BASE, published: false, channelId: "" });
    expect(resultado.success).toBe(true);
  });

  it("lleva si se avisa por privado", () => {
    const resultado = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      notificarPrivado: true,
      channelId: "",
    });
    expect(resultado.data?.notificarPrivado).toBe(true);
  });
});
