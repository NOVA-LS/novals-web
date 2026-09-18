import { describe, expect, it } from "vitest";
import { textoDeRespuesta } from "@/lib/forms/respuesta";
import type { Field } from "@/lib/forms/types";

const casilla: Field = { name: "acepto", kind: "checkbox", label: "Acepto" };
const lista: Extract<Field, { kind: "select" }> = {
  name: "color",
  kind: "select",
  label: "Color",
  options: [
    { value: "rojo", label: "Rojo" },
    { value: "azul", label: "Azul" },
  ],
};
const listaMultiple: Extract<Field, { kind: "select" }> = { ...lista, multiple: true };
const fecha: Field = { name: "cuando", kind: "date", label: "¿Cuándo?" };
const texto: Field = { name: "notas", kind: "text", label: "Notas" };

describe("textoDeRespuesta", () => {
  it("pinta la casilla como Sí o No", () => {
    expect(textoDeRespuesta(casilla, true)).toBe("Sí");
    expect(textoDeRespuesta(casilla, false)).toBe("No");
  });

  it("pinta la etiqueta de una opción, no su clave", () => {
    expect(textoDeRespuesta(lista, "azul")).toBe("Azul");
  });

  it("pinta la clave tal cual si ya no está en las opciones", () => {
    expect(textoDeRespuesta(lista, "morado")).toBe("morado");
  });

  it("une las etiquetas de una lista múltiple con comas", () => {
    expect(textoDeRespuesta(listaMultiple, ["azul", "rojo"])).toBe("Azul, Rojo");
  });

  it("no revienta si la múltiple llega sin marcar", () => {
    expect(textoDeRespuesta(listaMultiple, undefined)).toBe("");
  });

  it("formatea una fecha guardada como ISO", () => {
    expect(textoDeRespuesta(fecha, "2005-03-14")).toMatch(/2005/);
  });

  it("deja vacío lo que no tiene valor", () => {
    expect(textoDeRespuesta(fecha, "")).toBe("");
    expect(textoDeRespuesta(texto, undefined)).toBe("");
  });

  it("el resto de tipos se enseña tal cual", () => {
    expect(textoDeRespuesta(texto, "Hola")).toBe("Hola");
  });
});
