import { describe, expect, it } from "vitest";
import {
  getInsignia,
  insigniasGanadas,
  insigniasPendientes,
  INSIGNIAS,
  type MetricasJugador,
} from "@/lib/insignias/catalogo";
import { ICONOS_INSIGNIA } from "@/components/ui/insignia";

function metricas(cambios: Partial<MetricasJugador> = {}): MetricasJugador {
  return {
    diasDeCuenta: 0,
    mensajes: 0,
    hilos: 0,
    tieneWhitelist: false,
    esStaff: false,
    invitadosConWhitelist: 0,
    ...cambios,
  };
}

describe("catálogo", () => {
  it("no repite claves", () => {
    const slugs = INSIGNIAS.map((insignia) => insignia.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("todos los iconos existen", () => {
    for (const insignia of INSIGNIAS) {
      expect(ICONOS_INSIGNIA[insignia.icono], insignia.slug).toBeDefined();
    }
  });

  it("nadie empieza con insignias", () => {
    expect(insigniasGanadas(metricas())).toEqual([]);
  });
});

describe("condiciones", () => {
  it("la whitelist da ciudadano", () => {
    expect(insigniasGanadas(metricas({ tieneWhitelist: true }))).toContain("ciudadano");
  });

  it("los mensajes van sumando insignias por tramos", () => {
    expect(insigniasGanadas(metricas({ mensajes: 1 }))).toEqual(["primera-palabra"]);
    expect(insigniasGanadas(metricas({ mensajes: 25 }))).toEqual([
      "primera-palabra",
      "habitual",
    ]);
    expect(insigniasGanadas(metricas({ mensajes: 100 }))).toEqual([
      "primera-palabra",
      "habitual",
      "voz-de-la-ciudad",
    ]);
  });

  it("los tramos son inclusivos: justo en el número ya cuenta", () => {
    expect(insigniasGanadas(metricas({ hilos: 9 }))).not.toContain("narrador");
    expect(insigniasGanadas(metricas({ hilos: 10 }))).toContain("narrador");
    expect(insigniasGanadas(metricas({ diasDeCuenta: 179 }))).not.toContain("veterano");
    expect(insigniasGanadas(metricas({ diasDeCuenta: 180 }))).toContain("veterano");
  });

  it("el staff lleva la suya", () => {
    expect(insigniasGanadas(metricas({ esStaff: true }))).toContain("equipo");
  });

  it("los invitados con whitelist van sumando insignias por tramos", () => {
    expect(insigniasGanadas(metricas({ invitadosConWhitelist: 4 }))).not.toContain("reclutador");
    expect(insigniasGanadas(metricas({ invitadosConWhitelist: 5 }))).toEqual(["reclutador"]);
    expect(insigniasGanadas(metricas({ invitadosConWhitelist: 15 }))).toEqual([
      "reclutador",
      "embajador",
    ]);
  });
});

describe("pendientes", () => {
  it("solo devuelve lo que aún no tiene", () => {
    const suyas = insigniasPendientes(
      metricas({ mensajes: 30, tieneWhitelist: true }),
      ["ciudadano", "primera-palabra"],
    );
    expect(suyas).toEqual(["habitual"]);
  });

  it("no propone nada cuando ya las tiene todas", () => {
    const m = metricas({ mensajes: 100 });
    expect(insigniasPendientes(m, insigniasGanadas(m))).toEqual([]);
  });

  it("nunca pide quitar una que ya no se cumpliría", () => {
    // Se le borraron los mensajes, pero la insignia se queda: aquí solo se suma.
    const pendientes = insigniasPendientes(metricas({ mensajes: 0 }), ["habitual"]);
    expect(pendientes).toEqual([]);
  });
});

describe("avance", () => {
  it("va de 0 a 1 y no se pasa", () => {
    const habitual = getInsignia("habitual")!;
    expect(habitual.avance!(metricas({ mensajes: 0 }))).toBe(0);
    expect(habitual.avance!(metricas({ mensajes: 5 }))).toBeCloseTo(0.2);
    expect(habitual.avance!(metricas({ mensajes: 999 }))).toBe(1);
  });

  it("las que no son de contar no lo traen", () => {
    expect(getInsignia("ciudadano")!.avance).toBeUndefined();
  });
});
