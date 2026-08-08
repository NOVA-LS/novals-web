import { describe, expect, it } from "vitest";
import {
  DIA_MS,
  diasDesde,
  haceDias,
  HORA_MS,
  mediaDeRespuestaHoras,
  textoDeRespuesta,
} from "@/lib/stats";

const ENVIO = new Date("2026-07-01T10:00:00Z");

function resuelta(horas: number) {
  return { createdAt: ENVIO, resolvedAt: new Date(ENVIO.getTime() + horas * HORA_MS) };
}

describe("mediaDeRespuestaHoras", () => {
  it("no inventa una media cuando no hay resueltas", () => {
    expect(mediaDeRespuestaHoras([])).toBeNull();
    expect(mediaDeRespuestaHoras([{ createdAt: ENVIO, resolvedAt: null }])).toBeNull();
  });

  it("promedia solo las resueltas", () => {
    const media = mediaDeRespuestaHoras([
      resuelta(2),
      resuelta(4),
      { createdAt: ENVIO, resolvedAt: null },
    ]);

    expect(media).toBe(3);
  });

  it("descarta resoluciones anteriores al envío", () => {
    const media = mediaDeRespuestaHoras([
      resuelta(6),
      { createdAt: ENVIO, resolvedAt: new Date(ENVIO.getTime() - HORA_MS) },
    ]);

    expect(media).toBe(6);
  });
});

describe("diasDesde", () => {
  const referencia = new Date("2026-07-31T12:00:00Z");

  it("cuenta días enteros, sin redondear hacia arriba", () => {
    const casi = new Date(referencia.getTime() - (2 * DIA_MS - HORA_MS));
    expect(diasDesde(casi, referencia)).toBe(1);
  });

  it("da cero el mismo día", () => {
    expect(diasDesde(referencia, referencia)).toBe(0);
  });
});

describe("haceDias", () => {
  it("retrocede el número exacto de días", () => {
    const referencia = new Date("2026-07-31T12:00:00Z");
    expect(haceDias(7, referencia).toISOString()).toBe("2026-07-24T12:00:00.000Z");
  });
});

describe("textoDeRespuesta", () => {
  it("calla si no hay dato", () => {
    expect(textoDeRespuesta(null)).toBeNull();
  });

  it("agrupa lo muy rápido", () => {
    expect(textoDeRespuesta(0.4)).toBe("menos de 1 h");
  });

  it("da horas hasta los dos días", () => {
    expect(textoDeRespuesta(5.4)).toBe("5 h");
    expect(textoDeRespuesta(47)).toBe("47 h");
  });

  it("pasa a días cuando ya son muchas horas", () => {
    expect(textoDeRespuesta(72)).toBe("3 días");
  });
});
