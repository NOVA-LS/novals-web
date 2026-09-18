import { describe, expect, it } from "vitest";
import {
  puedeBorrar,
  puedeConcederInsignias,
  puedeEditar,
  puedeModerar,
  puedePublicar,
  puedeResponder,
  type Actor,
} from "@/lib/foro/reglas";
import { CATEGORIAS, getCategoria } from "@/lib/foro/categorias";

const jugador: Actor = { id: "u1", role: "USER", tieneWhitelist: true };
const recienLlegado: Actor = { id: "u2", role: "USER", tieneWhitelist: false };
const revisor: Actor = { id: "r1", role: "MODERADOR", tieneWhitelist: false };
const iniciador: Actor = { id: "i1", role: "INICIADOR", tieneWhitelist: false };
const admin: Actor = { id: "a1", role: "ADMIN", tieneWhitelist: false };

const hiloAbierto = { authorId: "u1", locked: false };
const hiloCerrado = { authorId: "u1", locked: true };

describe("puedePublicar", () => {
  it("deja escribir a quien pasó la whitelist", () => {
    expect(puedePublicar(jugador)).toBe(true);
  });

  it("no deja escribir a quien todavía no la pasó", () => {
    expect(puedePublicar(recienLlegado)).toBe(false);
  });

  it("deja escribir al staff aunque no tenga whitelist", () => {
    expect(puedePublicar(revisor)).toBe(true);
    expect(puedePublicar(admin)).toBe(true);
  });

  it("no deja escribir a quien no ha entrado", () => {
    expect(puedePublicar(null)).toBe(false);
  });
});

describe("puedeResponder", () => {
  it("permite responder en un hilo abierto", () => {
    expect(puedeResponder(jugador, hiloAbierto)).toBe(true);
  });

  it("bloquea a los jugadores en un hilo cerrado", () => {
    expect(puedeResponder(jugador, hiloCerrado)).toBe(false);
  });

  it("deja al staff cerrar la conversación con la última palabra", () => {
    expect(puedeResponder(revisor, hiloCerrado)).toBe(true);
  });

  it("sigue bloqueando a quien no tiene whitelist, esté abierto o no", () => {
    expect(puedeResponder(recienLlegado, hiloAbierto)).toBe(false);
  });
});

describe("puedeEditar", () => {
  it("solo el autor edita lo suyo", () => {
    expect(puedeEditar(jugador, { authorId: "u1" })).toBe(true);
    expect(puedeEditar(jugador, { authorId: "otro" })).toBe(false);
  });

  it("el staff no edita mensajes ajenos", () => {
    expect(puedeEditar(admin, { authorId: "u1" })).toBe(false);
  });
});

describe("puedeBorrar", () => {
  it("el autor borra lo suyo", () => {
    expect(puedeBorrar(jugador, { authorId: "u1" })).toBe(true);
  });

  it("el staff borra lo de cualquiera", () => {
    expect(puedeBorrar(revisor, { authorId: "u1" })).toBe(true);
  });

  it("un jugador no borra lo de otro", () => {
    expect(puedeBorrar(jugador, { authorId: "otro" })).toBe(false);
  });

  it("el iniciador tampoco: no modera", () => {
    expect(puedeBorrar(iniciador, { authorId: "otro" })).toBe(false);
    expect(puedeBorrar(iniciador, { authorId: "i1" })).toBe(true);
  });
});

describe("moderación e insignias", () => {
  it("moderar empieza en soporte: el iniciador se queda fuera", () => {
    expect(puedeModerar(admin)).toBe(true);
    expect(puedeModerar(revisor)).toBe(true);
    expect(puedeModerar(iniciador)).toBe(false);
    expect(puedeModerar(jugador)).toBe(false);
  });

  it("en un hilo cerrado solo escribe quien modera", () => {
    expect(puedeResponder(revisor, hiloCerrado)).toBe(true);
    expect(puedeResponder(iniciador, hiloCerrado)).toBe(false);
  });

  it("las insignias solo las toca un admin", () => {
    expect(puedeConcederInsignias(admin)).toBe(true);
    expect(puedeConcederInsignias(revisor)).toBe(false);
  });
});

describe("categorías", () => {
  it("encuentra una categoría existente", () => {
    // La primera del listado, sea cual sea: las categorías se cambian a mano y
    // la prueba es del buscador, no de qué categorías hay hoy.
    const primera = CATEGORIAS[0];
    expect(getCategoria(primera.slug)?.nombre).toBe(primera.nombre);
  });

  it("devuelve undefined con un slug inventado", () => {
    expect(getCategoria("no-existe")).toBeUndefined();
  });

  it("no tiene slugs repetidos", () => {
    const slugs = CATEGORIAS.map((categoria) => categoria.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
