import { describe, expect, it } from "vitest";
import { leerPagina, paginaDe, paginar, ventana } from "@/lib/paginacion";

describe("leerPagina", () => {
  it("lee un número correcto", () => {
    expect(leerPagina("4")).toBe(4);
  });

  it("cae en la primera cuando no hay parámetro", () => {
    expect(leerPagina(undefined)).toBe(1);
    expect(leerPagina("")).toBe(1);
  });

  it("no se fía de lo que venga en la URL", () => {
    expect(leerPagina("cero")).toBe(1);
    expect(leerPagina("0")).toBe(1);
    expect(leerPagina("-3")).toBe(1);
    expect(leerPagina("2.5")).toBe(1);
    // Repetir el parámetro deja un array; tampoco vale.
    expect(leerPagina(["2", "3"])).toBe(1);
  });
});

describe("paginar", () => {
  it("reparte lo que pide la consulta", () => {
    expect(paginar(50, 20, 2)).toEqual({
      actual: 2,
      paginas: 3,
      total: 50,
      salta: 20,
      toma: 20,
    });
  });

  it("deja una página aunque no haya nada", () => {
    expect(paginar(0, 20, 1)).toMatchObject({ actual: 1, paginas: 1, salta: 0 });
  });

  it("no deja pasar de la última", () => {
    expect(paginar(50, 20, 999)).toMatchObject({ actual: 3, salta: 40 });
  });

  it("la última página guarda el resto", () => {
    expect(paginar(41, 20, 3)).toMatchObject({ paginas: 3, salta: 40 });
  });
});

describe("paginaDe", () => {
  it("sitúa un elemento por su posición", () => {
    expect(paginaDe(0, 20)).toBe(1);
    expect(paginaDe(19, 20)).toBe(1);
    expect(paginaDe(20, 20)).toBe(2);
    expect(paginaDe(45, 20)).toBe(3);
  });
});

describe("ventana", () => {
  it("enseña todas cuando caben", () => {
    expect(ventana(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("abre hueco a los lados", () => {
    expect(ventana(6, 12)).toEqual([1, "hueco", 5, 6, 7, "hueco", 12]);
  });

  it("no esconde una sola página tras un hueco", () => {
    expect(ventana(4, 8)).toEqual([1, 2, 3, 4, 5, "hueco", 8]);
  });

  it("se pega al principio y al final", () => {
    expect(ventana(1, 9)).toEqual([1, 2, "hueco", 9]);
    expect(ventana(9, 9)).toEqual([1, "hueco", 8, 9]);
  });
});
