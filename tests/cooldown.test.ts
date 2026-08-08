import { describe, expect, it } from "vitest";
import {
  avanceEspera,
  desglosarEspera,
  esperaRestante,
  formatearEspera,
} from "@/lib/cooldown";

const AHORA = new Date("2026-08-01T12:00:00Z");
const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe("esperaRestante", () => {
  it("cuenta los milisegundos que faltan", () => {
    expect(esperaRestante(new Date(AHORA.getTime() + 2 * HORA), AHORA)).toBe(2 * HORA);
  });

  it("no devuelve negativos cuando la fecha ya pasó", () => {
    expect(esperaRestante(new Date(AHORA.getTime() - DIA), AHORA)).toBe(0);
  });
});

describe("desglosarEspera", () => {
  it("parte la espera en unidades", () => {
    expect(desglosarEspera(2 * DIA + 3 * HORA + 4 * MINUTO + 5 * SEGUNDO)).toEqual({
      dias: 2,
      horas: 3,
      minutos: 4,
      segundos: 5,
    });
  });

  it("deja todo a cero cuando la espera terminó", () => {
    expect(desglosarEspera(-1)).toEqual({
      dias: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
    });
  });
});

describe("avanceEspera", () => {
  const inicio = new Date(AHORA.getTime() - 3 * DIA);
  const fin = new Date(AHORA.getTime() + DIA);

  it("mide la parte ya cumplida", () => {
    expect(avanceEspera(inicio, fin, AHORA)).toBeCloseTo(0.75);
  });

  it("sin fecha de inicio no dibuja nada", () => {
    expect(avanceEspera(null, fin, AHORA)).toBe(0);
  });

  it("no se sale del rango cuando la fecha ya pasó", () => {
    expect(avanceEspera(inicio, new Date(AHORA.getTime() - HORA), AHORA)).toBe(1);
  });
});

describe("formatearEspera", () => {
  it("dice «ya» cuando no queda nada", () => {
    expect(formatearEspera(0)).toBe("ya");
    expect(formatearEspera(-5000)).toBe("ya");
  });

  it("con días, enseña días y horas", () => {
    expect(formatearEspera(3 * DIA + 4 * HORA + 59 * MINUTO)).toBe("3 días · 4 h");
  });

  it("no pluraliza el día suelto", () => {
    expect(formatearEspera(DIA + 2 * HORA)).toBe("1 día · 2 h");
  });

  it("con menos de un día, enseña horas y minutos", () => {
    expect(formatearEspera(5 * HORA + 12 * MINUTO + 40 * SEGUNDO)).toBe(
      "5 horas · 12 min",
    );
  });

  it("con menos de una hora, enseña minutos y segundos", () => {
    expect(formatearEspera(7 * MINUTO + 9 * SEGUNDO)).toBe("7 min · 9 s");
  });

  it("en el último minuto, solo segundos", () => {
    expect(formatearEspera(42 * SEGUNDO)).toBe("42 s");
  });

  it("no se salta las unidades a cero", () => {
    expect(formatearEspera(2 * DIA)).toBe("2 días · 0 h");
  });
});
