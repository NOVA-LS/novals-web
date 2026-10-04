import { describe, expect, it } from "vitest";
import { debeAvisar, esquemaNoticia } from "@/lib/noticias";

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

  it("deja guardar una noticia sin encuesta", () => {
    const resultado = esquemaNoticia.safeParse({ ...BASE, published: true, encuesta: null });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.encuesta).toBeNull();
  });

  it("valida la encuesta cuando viene", () => {
    const buena = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      encuesta: { options: [{ label: "Sí" }, { label: "No" }] },
    });
    expect(buena.success).toBe(true);

    const mala = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      encuesta: { options: [{ label: "Sí" }] },
    });
    expect(mala.success).toBe(false);
  });
});

describe("debeAvisar", () => {
  const base = {
    publicando: true,
    estabaPublicada: false,
    yaAvisada: false,
    canal: true,
    privado: false,
    reavisar: false,
  };

  it("avisa la primera vez que se publica con canal", () => {
    expect(debeAvisar(base)).toBe(true);
  });

  it("avisa con solo el privado", () => {
    expect(debeAvisar({ ...base, canal: false, privado: true })).toBe(true);
  });

  it("avisa si ya estaba publicada pero nunca se avisó (se añade canal después)", () => {
    expect(debeAvisar({ ...base, estabaPublicada: true })).toBe(true);
  });

  it("no avisa al guardar cambios de una noticia ya publicada y ya avisada", () => {
    expect(debeAvisar({ ...base, estabaPublicada: true, yaAvisada: true, reavisar: true })).toBe(
      false,
    );
  });

  it("al volver a publicar una ya avisada, no avisa si no se pide", () => {
    expect(debeAvisar({ ...base, yaAvisada: true })).toBe(false);
  });

  it("al volver a publicar una ya avisada, avisa si se pide", () => {
    expect(debeAvisar({ ...base, yaAvisada: true, reavisar: true })).toBe(true);
  });

  it("no avisa si no se publica", () => {
    expect(debeAvisar({ ...base, publicando: false })).toBe(false);
  });

  it("no avisa si no hay ni canal ni privado, aunque se pida", () => {
    expect(debeAvisar({ ...base, canal: false, privado: false, reavisar: true })).toBe(false);
  });
});
