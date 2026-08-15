import { describe, expect, it } from "vitest";
import { DIA_MS, puedeEnviar } from "@/lib/rules";

const AHORA = new Date("2026-08-01T12:00:00Z");

describe("puedeEnviar", () => {
  it("permite enviar cuando no hay solicitudes previas", () => {
    expect(
      puedeEnviar({ abierto: true, ultima: null, cooldownDays: 7, ahora: AHORA }),
    ).toEqual({ permitido: true });
  });

  it("bloquea si el formulario está cerrado", () => {
    const veredicto = puedeEnviar({
      abierto: false,
      ultima: null,
      cooldownDays: 7,
      ahora: AHORA,
    });

    expect(veredicto.permitido).toBe(false);
  });

  it("bloquea si ya hay una solicitud pendiente", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: { status: "PENDING", resolvedAt: null },
      cooldownDays: 7,
      ahora: AHORA,
    });

    expect(veredicto).toMatchObject({ permitido: false });
  });

  it("bloquea si ya hay una solicitud en revisión", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: { status: "IN_REVIEW", resolvedAt: null },
      cooldownDays: 7,
      ahora: AHORA,
    });

    expect(veredicto.permitido).toBe(false);
  });

  it("bloquea durante el cooldown tras un rechazo", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: {
        status: "REJECTED",
        resolvedAt: new Date(AHORA.getTime() - 3 * DIA_MS),
      },
      cooldownDays: 7,
      ahora: AHORA,
    });

    expect(veredicto.permitido).toBe(false);
    if (!veredicto.permitido) expect(veredicto.motivo).toContain("4 día");
  });

  it("permite reenviar cuando el cooldown ya pasó", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: {
        status: "REJECTED",
        resolvedAt: new Date(AHORA.getTime() - 8 * DIA_MS),
      },
      cooldownDays: 7,
      ahora: AHORA,
    });

    expect(veredicto).toEqual({ permitido: true });
  });

  it("permite reenviar de inmediato si el cooldown es cero", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: { status: "REJECTED", resolvedAt: AHORA },
      cooldownDays: 0,
      ahora: AHORA,
    });

    expect(veredicto).toEqual({ permitido: true });
  });

  it("permite reenviar tras una solicitud aceptada", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: { status: "ACCEPTED", resolvedAt: AHORA },
      cooldownDays: 7,
      ahora: AHORA,
    });

    expect(veredicto).toEqual({ permitido: true });
  });

  it("bloquea antes de que empiece la ventana programada", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: null,
      cooldownDays: 7,
      ahora: AHORA,
      openFrom: new Date(AHORA.getTime() + 3 * DIA_MS),
    });

    expect(veredicto.permitido).toBe(false);
    if (!veredicto.permitido) expect(veredicto.hasta).toBeInstanceOf(Date);
  });

  it("bloquea después de que termine la ventana programada", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: null,
      cooldownDays: 7,
      ahora: AHORA,
      openUntil: new Date(AHORA.getTime() - DIA_MS),
    });

    expect(veredicto.permitido).toBe(false);
  });

  it("permite enviar dentro de la ventana programada", () => {
    const veredicto = puedeEnviar({
      abierto: true,
      ultima: null,
      cooldownDays: 7,
      ahora: AHORA,
      openFrom: new Date(AHORA.getTime() - DIA_MS),
      openUntil: new Date(AHORA.getTime() + DIA_MS),
    });

    expect(veredicto).toEqual({ permitido: true });
  });

  it("el cierre manual manda por encima de la ventana programada", () => {
    const veredicto = puedeEnviar({
      abierto: false,
      ultima: null,
      cooldownDays: 7,
      ahora: AHORA,
      openFrom: new Date(AHORA.getTime() - DIA_MS),
      openUntil: new Date(AHORA.getTime() + DIA_MS),
    });

    expect(veredicto.permitido).toBe(false);
  });
});
