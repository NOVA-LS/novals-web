import { describe, expect, it } from "vitest";
import { construirAvisoTicket } from "@/lib/notifications/tickets";
import { EMBED_COLOR } from "@/lib/embed";

const ENLACE = "https://nova.example/tickets/abc123";

describe("construirAvisoTicket", () => {
  it("avisa de una respuesta con quién escribió y enlaza al ticket", () => {
    const embed = construirAvisoTicket(
      { evento: "mensaje", numero: 42, asunto: "No conecto", autor: "Ana", texto: "¿Sigues ahí?" },
      ENLACE,
    );

    expect(embed.title).toBe("Respuesta en tu ticket #42");
    expect(embed.url).toBe(ENLACE);
    expect(embed.description).toContain("Ana");
    expect(embed.fields).toEqual([{ name: "Mensaje", value: "¿Sigues ahí?" }]);
  });

  it("avisa del cierre", () => {
    const embed = construirAvisoTicket(
      { evento: "cerrado", numero: 7, asunto: "Duda" },
      ENLACE,
    );

    expect(embed.title).toBe("Tu ticket #7 se ha cerrado");
    expect(embed.color).toBe(EMBED_COLOR.accepted);
    expect(embed.url).toBe(ENLACE);
  });

  it("avisa de la reapertura", () => {
    const embed = construirAvisoTicket(
      { evento: "reabierto", numero: 7, asunto: "Duda" },
      ENLACE,
    );

    expect(embed.title).toBe("Tu ticket #7 se ha reabierto");
    expect(embed.color).toBe(EMBED_COLOR.pending);
  });

  it("avisa de que te han metido en uno, diciendo quién", () => {
    const embed = construirAvisoTicket(
      { evento: "invitado", numero: 3, asunto: "Reporte", quien: "Iván" },
      ENLACE,
    );

    expect(embed.title).toBe("Te han metido en el ticket #3");
    expect(embed.description).toContain("Iván");
    expect(embed.url).toBe(ENLACE);
  });

  it("recorta un mensaje kilométrico al límite de Discord", () => {
    const embed = construirAvisoTicket(
      { evento: "mensaje", numero: 1, asunto: "x", autor: "A", texto: "x".repeat(2000) },
      ENLACE,
    );

    const mensaje = embed.fields?.[0]?.value ?? "";
    expect(mensaje).toHaveLength(1000);
    expect(mensaje.endsWith("…")).toBe(true);
  });
});
