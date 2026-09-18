import { describe, expect, it, vi } from "vitest";
import { CANAL, emitir, emitirA, escuchar } from "@/lib/eventos";

describe("bus de eventos", () => {
  it("avisa a quien escucha ese canal", () => {
    const oyente = vi.fn();
    const baja = escuchar("prueba:1", oyente);

    emitir("prueba:1");
    expect(oyente).toHaveBeenCalledTimes(1);

    baja();
  });

  it("no molesta a los demás canales", () => {
    const oyente = vi.fn();
    const baja = escuchar("prueba:2", oyente);

    emitir("prueba:3");
    expect(oyente).not.toHaveBeenCalled();

    baja();
  });

  it("darse de baja deja de recibir", () => {
    const oyente = vi.fn();
    escuchar("prueba:4", oyente)();

    emitir("prueba:4");
    expect(oyente).not.toHaveBeenCalled();
  });

  it("con varios oyentes se avisa a todos", () => {
    const uno = vi.fn();
    const otro = vi.fn();
    const bajas = [escuchar("prueba:5", uno), escuchar("prueba:5", otro)];

    emitir("prueba:5");
    expect(uno).toHaveBeenCalledOnce();
    expect(otro).toHaveBeenCalledOnce();

    for (const baja of bajas) baja();
  });

  it("emitir a varios canales repetidos avisa una sola vez", () => {
    const oyente = vi.fn();
    const baja = escuchar("prueba:6", oyente);

    emitirA(["prueba:6", "prueba:6", "prueba:7"]);
    expect(oyente).toHaveBeenCalledTimes(1);

    baja();
  });

  it("un oyente que falla no impide avisar al resto", () => {
    const roto = vi.fn(() => {
      throw new Error("vaya");
    });
    const bueno = vi.fn();
    const bajas = [escuchar("prueba:8", roto), escuchar("prueba:8", bueno)];

    // El error se registra, pero el aviso sigue su camino.
    vi.spyOn(console, "error").mockImplementation(() => {});
    emitir("prueba:8");
    expect(bueno).toHaveBeenCalledOnce();

    for (const baja of bajas) baja();
    vi.restoreAllMocks();
  });

  it("los nombres de canal salen siempre del mismo sitio", () => {
    expect(CANAL.usuario("u1")).toBe("usuario:u1");
    expect(CANAL.ticket("t1")).toBe("ticket:t1");
    expect(CANAL.panel()).toBe("panel");
    expect(CANAL.foro()).toBe("foro");
  });
});
