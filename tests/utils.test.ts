import { describe, expect, it } from "vitest";
import { hace, slugify } from "@/lib/utils";

const AHORA = new Date("2026-08-01T12:00:00Z");
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

function haceRato(ms: number) {
  return new Date(AHORA.getTime() - ms);
}

describe("hace", () => {
  it("llama ahora mismo a lo de hace nada", () => {
    expect(hace(haceRato(20 * 1000), AHORA)).toBe("ahora mismo");
  });

  it("cuenta en minutos dentro de la hora", () => {
    expect(hace(haceRato(5 * MINUTO), AHORA)).toBe("hace 5 min");
    expect(hace(haceRato(59 * MINUTO), AHORA)).toBe("hace 59 min");
  });

  it("cuenta en horas dentro del día", () => {
    expect(hace(haceRato(3 * HORA), AHORA)).toBe("hace 3 h");
  });

  it("cuenta en días hasta la semana", () => {
    expect(hace(haceRato(2 * DIA), AHORA)).toBe("hace 2 d");
    expect(hace(haceRato(6 * DIA), AHORA)).toBe("hace 6 d");
  });

  it("a partir de una semana vuelve la fecha", () => {
    expect(hace(haceRato(8 * DIA), AHORA)).toMatch(/jul|2026/);
  });
});

describe("slugify", () => {
  it("quita acentos y símbolos", () => {
    expect(slugify("¡Presentación de Ramón!")).toBe("presentacion-de-ramon");
  });

  it("no deja guiones sueltos en los extremos", () => {
    expect(slugify("  hola  ")).toBe("hola");
  });
});
