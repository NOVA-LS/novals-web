import { describe, expect, it } from "vitest";
import { construirAviso } from "@/lib/notifications/mensajes";
import { EMBED_COLOR } from "@/lib/embed";

const ENLACE = "https://nova.example/mis-solicitudes";

describe("construirAviso", () => {
  it("acusa recibo del envío y enlaza a las solicitudes", () => {
    const embed = construirAviso(
      { evento: "recibida", formTitle: "Whitelist" },
      ENLACE,
    );

    expect(embed.title).toContain("Whitelist");
    expect(embed.url).toBe(ENLACE);
    expect(embed.color).toBe(EMBED_COLOR.pending);
  });

  it("avisa de que un revisor la está leyendo", () => {
    const embed = construirAviso(
      { evento: "en_revision", formTitle: "Facción" },
      ENLACE,
    );

    expect(embed.title).toBe("En revisión · Facción");
    expect(embed.fields).toBeUndefined();
  });

  it("da la enhorabuena con la nota del staff cuando acepta", () => {
    const embed = construirAviso(
      {
        evento: "resuelta",
        formTitle: "Whitelist",
        estado: "ACCEPTED",
        nota: "Buen trasfondo.",
        cooldownDays: 7,
      },
      ENLACE,
    );

    expect(embed.title).toBe("Aceptada · Whitelist");
    expect(embed.color).toBe(EMBED_COLOR.accepted);
    expect(embed.fields).toEqual([
      { name: "Nota del staff", value: "Buen trasfondo." },
    ]);
  });

  it("no inventa una nota si el staff no la dejó", () => {
    const embed = construirAviso(
      {
        evento: "resuelta",
        formTitle: "Whitelist",
        estado: "ACCEPTED",
        nota: "   ",
        cooldownDays: 7,
      },
      ENLACE,
    );

    expect(embed.fields).toEqual([]);
  });

  it("al rechazar dice la nota y cuándo se puede reenviar", () => {
    const embed = construirAviso(
      {
        evento: "resuelta",
        formTitle: "Staff",
        estado: "REJECTED",
        nota: "Falta detalle en la historia.",
        cooldownDays: 14,
      },
      ENLACE,
    );

    expect(embed.color).toBe(EMBED_COLOR.rejected);
    expect(embed.fields?.[0]?.value).toBe("Falta detalle en la historia.");
    expect(embed.fields?.[1]?.value).toContain("14 día");
  });

  it("al rechazar sin cooldown invita a reenviar cuando quiera", () => {
    const embed = construirAviso(
      {
        evento: "resuelta",
        formTitle: "Staff",
        estado: "REJECTED",
        nota: null,
        cooldownDays: 0,
      },
      ENLACE,
    );

    expect(embed.description).toContain("no ha dejado nota");
    expect(embed.fields).toEqual([
      { name: "Cuándo puedes reenviarla", value: "Cuando quieras, no hay espera." },
    ]);
  });

  it("recorta una nota kilométrica al límite de Discord", () => {
    const embed = construirAviso(
      {
        evento: "resuelta",
        formTitle: "Whitelist",
        estado: "REJECTED",
        nota: "x".repeat(2000),
        cooldownDays: 7,
      },
      ENLACE,
    );

    const nota = embed.fields?.[0]?.value ?? "";
    expect(nota).toHaveLength(1000);
    expect(nota.endsWith("…")).toBe(true);
  });
});
