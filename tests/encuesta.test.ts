import { describe, expect, it } from "vitest";
import {
  cambiosPermitidos,
  cierreValido,
  encuestaAbierta,
  esquemaEncuesta,
  leerEncuestaDelFormulario,
  porcentaje,
  puedeVotar,
} from "@/lib/encuesta";

const AHORA = new Date("2026-10-04T12:00:00Z");
const FUTURO = new Date("2026-10-10T12:00:00Z");
const PASADO = new Date("2026-10-01T12:00:00Z");

describe("esquemaEncuesta", () => {
  it("acepta dos opciones y deja la pregunta y el cierre sin rellenar", () => {
    const resultado = esquemaEncuesta.safeParse({
      question: "",
      closesAt: "",
      options: [{ label: "Sí" }, { label: "No" }],
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.question).toBeUndefined();
    expect(resultado.data?.closesAt).toBeUndefined();
  });

  it("convierte la fecha de cierre en Date", () => {
    const resultado = esquemaEncuesta.safeParse({
      closesAt: "2026-10-10T12:00:00.000Z",
      options: [{ label: "Sí" }, { label: "No" }],
    });
    expect(resultado.data?.closesAt?.toISOString()).toBe("2026-10-10T12:00:00.000Z");
  });

  it("rechaza una fecha que no lo es", () => {
    const resultado = esquemaEncuesta.safeParse({
      closesAt: "mañana",
      options: [{ label: "Sí" }, { label: "No" }],
    });
    expect(resultado.success).toBe(false);
  });

  it("rechaza una sola opción", () => {
    const resultado = esquemaEncuesta.safeParse({ options: [{ label: "Sí" }] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("La encuesta necesita al menos 2 opciones.");
  });

  it("rechaza más de seis opciones", () => {
    const opciones = Array.from({ length: 7 }, (_, i) => ({ label: `Opción ${i}` }));
    expect(esquemaEncuesta.safeParse({ options: opciones }).success).toBe(false);
  });

  it("rechaza una opción vacía o demasiado larga", () => {
    expect(
      esquemaEncuesta.safeParse({ options: [{ label: "  " }, { label: "No" }] }).success,
    ).toBe(false);
    expect(
      esquemaEncuesta.safeParse({ options: [{ label: "a".repeat(81) }, { label: "No" }] })
        .success,
    ).toBe(false);
  });

  it("rechaza opciones repetidas aunque cambien las mayúsculas o los espacios", () => {
    const resultado = esquemaEncuesta.safeParse({
      options: [{ label: "Sí" }, { label: " sí " }],
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("Hay opciones repetidas.");
  });

  it("trata el id vacío como opción nueva", () => {
    const resultado = esquemaEncuesta.safeParse({
      options: [{ id: "", label: "Sí" }, { id: "abc", label: "No" }],
    });
    expect(resultado.data?.options[0].id).toBeUndefined();
    expect(resultado.data?.options[1].id).toBe("abc");
  });
});

describe("encuestaAbierta", () => {
  it("está abierta sin fecha de cierre", () => {
    expect(encuestaAbierta({ closesAt: null }, AHORA)).toBe(true);
  });
  it("está abierta con el cierre en el futuro", () => {
    expect(encuestaAbierta({ closesAt: FUTURO }, AHORA)).toBe(true);
  });
  it("está cerrada con el cierre en el pasado", () => {
    expect(encuestaAbierta({ closesAt: PASADO }, AHORA)).toBe(false);
  });
});

describe("puedeVotar", () => {
  it("deja votar en una encuesta abierta de una noticia publicada", () => {
    expect(puedeVotar({ published: true }, { closesAt: null }, AHORA)).toEqual({ ok: true });
  });
  it("no deja votar si la noticia está despublicada", () => {
    const resultado = puedeVotar({ published: false }, { closesAt: null }, AHORA);
    expect(resultado.ok).toBe(false);
  });
  it("no deja votar si la encuesta está cerrada", () => {
    const resultado = puedeVotar({ published: true }, { closesAt: PASADO }, AHORA);
    expect(resultado).toEqual({ ok: false, mensaje: "La encuesta está cerrada." });
  });
});

describe("cierreValido", () => {
  it("sin fecha siempre vale", () => {
    expect(cierreValido(undefined, true, AHORA)).toBe(true);
  });
  it("una encuesta nueva no puede nacer cerrada", () => {
    expect(cierreValido(PASADO, true, AHORA)).toBe(false);
    expect(cierreValido(FUTURO, true, AHORA)).toBe(true);
  });
  it("una encuesta existente sí puede cerrarse a mano con una fecha pasada", () => {
    expect(cierreValido(PASADO, false, AHORA)).toBe(true);
  });
});

describe("cambiosPermitidos", () => {
  const actuales = [
    { id: "a", label: "Sí" },
    { id: "b", label: "No" },
  ];

  it("sin votos deja cambiar, quitar y añadir", () => {
    const nuevas = [{ id: "a", label: "Claro" }, { label: "Quizá" }];
    expect(cambiosPermitidos(actuales, nuevas, false)).toEqual({ ok: true });
  });

  it("con votos deja añadir una opción nueva", () => {
    const nuevas = [...actuales, { label: "Quizá" }];
    expect(cambiosPermitidos(actuales, nuevas, true)).toEqual({ ok: true });
  });

  it("con votos no deja cambiar el texto de una opción", () => {
    const nuevas = [{ id: "a", label: "Claro" }, actuales[1]];
    const resultado = cambiosPermitidos(actuales, nuevas, true);
    expect(resultado.ok).toBe(false);
  });

  it("con votos no deja quitar una opción", () => {
    const resultado = cambiosPermitidos(actuales, [actuales[0], { label: "Otra" }], true);
    expect(resultado.ok).toBe(false);
  });

  it("rechaza un id que no es de esta encuesta, con o sin votos", () => {
    const nuevas = [{ id: "zzz", label: "Sí" }, { label: "No" }];
    expect(cambiosPermitidos(actuales, nuevas, false).ok).toBe(false);
    expect(cambiosPermitidos(actuales, nuevas, true).ok).toBe(false);
  });

  it("una encuesta nueva no admite ids", () => {
    expect(cambiosPermitidos([], [{ id: "a", label: "Sí" }, { label: "No" }], false).ok).toBe(
      false,
    );
  });
});

describe("porcentaje", () => {
  it("con cero votos en total da 0, no NaN", () => {
    expect(porcentaje(0, 0)).toBe(0);
  });
  it("redondea al entero más cercano", () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
    expect(porcentaje(3, 3)).toBe(100);
  });
});

describe("leerEncuestaDelFormulario", () => {
  it("devuelve null si el interruptor no está activado", () => {
    const datos = new FormData();
    datos.append("pollOptionLabel", "Sí");
    expect(leerEncuestaDelFormulario(datos)).toBeNull();
  });

  it("empareja cada id con su texto por posición", () => {
    const datos = new FormData();
    datos.append("pollEnabled", "on");
    datos.append("pollQuestion", "¿Os gusta?");
    datos.append("pollClosesAt", "2026-10-10T12:00:00.000Z");
    datos.append("pollOptionId", "a");
    datos.append("pollOptionLabel", "Sí");
    datos.append("pollOptionId", "");
    datos.append("pollOptionLabel", "No");

    expect(leerEncuestaDelFormulario(datos)).toEqual({
      question: "¿Os gusta?",
      closesAt: "2026-10-10T12:00:00.000Z",
      options: [
        { id: "a", label: "Sí" },
        { id: "", label: "No" },
      ],
    });
  });
});
