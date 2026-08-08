import { describe, expect, it } from "vitest";
import {
  cambiosParaDiscord,
  equiposDesdeDiscord,
  hayMapa,
  leerMapa,
  rolDesdeDiscord,
  whitelistDesdeDiscord,
  type MapaDiscord,
} from "@/lib/discord/roles";

const MAPA: MapaDiscord = {
  roles: {
    INICIADOR: "100",
    SOPORTE: "200",
    MODERADOR: "300",
    ADMIN: "400",
  },
  equipos: { DEV: "900" },
  whitelist: "500",
};

describe("leer el mapa del entorno", () => {
  it("recoge lo que esté puesto", () => {
    const mapa = leerMapa({
      DISCORD_ROL_MODERADOR: "300",
      DISCORD_EQUIPO_DEV: " 900 ",
    });

    expect(mapa.roles.MODERADOR).toBe("300");
    expect(mapa.equipos.DEV).toBe("900");
  });

  it("ignora lo que falta o viene vacío", () => {
    const mapa = leerMapa({ DISCORD_ROL_ADMIN: "   " });
    expect(mapa.roles.ADMIN).toBeUndefined();
    expect(hayMapa(mapa)).toBe(false);
  });
});

describe("de Discord a la web", () => {
  it("sin roles nuestros es un jugador sin equipo", () => {
    expect(rolDesdeDiscord(["777"], MAPA)).toBe("USER");
    expect(equiposDesdeDiscord(["777"], MAPA)).toEqual([]);
  });

  it("lee el escalón que lleva", () => {
    expect(rolDesdeDiscord(["200"], MAPA)).toBe("SOPORTE");
  });

  it("con varios escalones manda el más alto", () => {
    expect(rolDesdeDiscord(["100", "300", "200"], MAPA)).toBe("MODERADOR");
  });

  it("lee el equipo aparte del escalón", () => {
    expect(equiposDesdeDiscord(["300", "900"], MAPA)).toEqual(["DEV"]);
  });

  it("lee varios equipos a la vez, en el orden del catálogo", () => {
    const mapa: MapaDiscord = {
      roles: {},
      equipos: { DEV: "900", EVENTOS: "901", REDES: "902" },
    };

    expect(equiposDesdeDiscord(["901", "900"], mapa)).toEqual(["DEV", "EVENTOS"]);
  });
});

describe("de la web a Discord", () => {
  it("pone el que falta", () => {
    expect(
      cambiosParaDiscord({
        rol: "SOPORTE",
        equipos: [],
        rolesDelMiembro: [],
        mapa: MAPA,
      }),
    ).toEqual({ poner: ["200"], quitar: [] });
  });

  it("quita el escalón viejo al ascender", () => {
    const cambios = cambiosParaDiscord({
      rol: "MODERADOR",
      equipos: [],
      rolesDelMiembro: ["200"],
      mapa: MAPA,
    });

    expect(cambios.poner).toEqual(["300"]);
    expect(cambios.quitar).toEqual(["200"]);
  });

  it("no toca nada si ya está como debe", () => {
    expect(
      cambiosParaDiscord({
        rol: "ADMIN",
        equipos: ["DEV"],
        rolesDelMiembro: ["400", "900"],
        mapa: MAPA,
      }),
    ).toEqual({ poner: [], quitar: [] });
  });

  it("al dejar de ser staff se le quita todo lo nuestro", () => {
    const cambios = cambiosParaDiscord({
      rol: "USER",
      equipos: [],
      rolesDelMiembro: ["300", "900"],
      mapa: MAPA,
    });

    expect(cambios.poner).toEqual([]);
    expect(cambios.quitar.sort()).toEqual(["300", "900"]);
  });

  it("no se mete con los roles que no son nuestros", () => {
    const cambios = cambiosParaDiscord({
      rol: "USER",
      equipos: [],
      // Facción, color, lo que sea: no está en el mapa, no se toca.
      rolesDelMiembro: ["777", "888"],
      mapa: MAPA,
    });

    expect(cambios).toEqual({ poner: [], quitar: [] });
  });

  it("el equipo va aparte del escalón", () => {
    const cambios = cambiosParaDiscord({
      rol: "ADMIN",
      equipos: ["DEV"],
      rolesDelMiembro: ["400"],
      mapa: MAPA,
    });

    expect(cambios).toEqual({ poner: ["900"], quitar: [] });
  });

  it("con varios equipos pone los que faltan y quita los que sobran", () => {
    const mapa: MapaDiscord = {
      roles: { ADMIN: "400" },
      equipos: { DEV: "900", EVENTOS: "901", REDES: "902" },
    };

    const cambios = cambiosParaDiscord({
      rol: "ADMIN",
      equipos: ["DEV", "REDES"],
      rolesDelMiembro: ["400", "901", "900"],
      mapa,
    });

    expect(cambios.poner).toEqual(["902"]);
    expect(cambios.quitar).toEqual(["901"]);
  });

  it("lo que no esté configurado no se sincroniza", () => {
    const parcial: MapaDiscord = { roles: { ADMIN: "400" }, equipos: {} };
    const cambios = cambiosParaDiscord({
      rol: "SOPORTE",
      equipos: ["DEV"],
      rolesDelMiembro: ["400"],
      mapa: parcial,
    });

    // Soporte y DEV no tienen identificador: solo se puede quitar el de admin.
    expect(cambios).toEqual({ poner: [], quitar: ["400"] });
  });
});

describe("whitelist", () => {
  it("se lee del rol de Discord", () => {
    expect(whitelistDesdeDiscord(["500"], MAPA)).toBe(true);
    expect(whitelistDesdeDiscord(["300"], MAPA)).toBe(false);
  });

  it("sin rol configurado nunca da por hecho que la tiene", () => {
    const sinWhitelist: MapaDiscord = { roles: {}, equipos: {} };
    expect(whitelistDesdeDiscord(["500"], sinWhitelist)).toBe(false);
  });

  it("se pone al aceptarla y se quita al perderla", () => {
    expect(
      cambiosParaDiscord({
        rol: "USER",
        equipos: [],
        whitelist: true,
        rolesDelMiembro: [],
        mapa: MAPA,
      }),
    ).toEqual({ poner: ["500"], quitar: [] });

    expect(
      cambiosParaDiscord({
        rol: "USER",
        equipos: [],
        whitelist: false,
        rolesDelMiembro: ["500"],
        mapa: MAPA,
      }),
    ).toEqual({ poner: [], quitar: ["500"] });
  });

  it("va aparte del escalón: un admin puede no tenerla", () => {
    expect(
      cambiosParaDiscord({
        rol: "ADMIN",
        equipos: [],
        whitelist: false,
        rolesDelMiembro: ["400"],
        mapa: MAPA,
      }),
    ).toEqual({ poner: [], quitar: [] });
  });
});
