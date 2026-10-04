import { describe, expect, it } from "vitest";
import { construirEmbedCanalNoticia, construirEmbedNoticia } from "@/lib/discord/noticia";
import { EMBED_COLOR } from "@/lib/embed";

describe("construirEmbedNoticia", () => {
  it("lleva la cabecera de aviso y el título como enlace", () => {
    const embed = construirEmbedNoticia(
      { title: "Se abre la temporada", excerpt: "Vuelve el servidor.", coverImage: null },
      "https://nova.example/noticias/se-abre-la-temporada",
    );

    expect(embed.author?.name).toBe("Se ha publicado una nueva noticia");
    expect(embed.title).toBe("Se abre la temporada");
    expect(embed.url).toBe("https://nova.example/noticias/se-abre-la-temporada");
    expect(embed.color).toBe(EMBED_COLOR.neutral);
  });

  it("muestra la entradilla y una invitación a leerla en la web", () => {
    const embed = construirEmbedNoticia(
      { title: "Evento", excerpt: "Vuelve el servidor.", coverImage: null },
      "https://nova.example/noticias/evento",
    );

    expect(embed.description).toBe("Vuelve el servidor.");
    expect(embed.footer?.text).toContain("web");
  });

  it("lleva la portada como imagen cuando la noticia tiene", () => {
    const embed = construirEmbedNoticia(
      {
        title: "Evento",
        excerpt: "Detalles.",
        coverImage: "https://nova.example/uploads/portada.png",
      },
      "https://nova.example/noticias/evento",
    );

    expect(embed.image).toEqual({ url: "https://nova.example/uploads/portada.png" });
  });

  it("sin portada no manda ninguna imagen", () => {
    const embed = construirEmbedNoticia(
      { title: "Evento", excerpt: "Detalles.", coverImage: null },
      "https://nova.example/noticias/evento",
    );

    expect(embed.image).toBeUndefined();
  });

  it("sin url de baja, el pie invita a leer la noticia", () => {
    const embed = construirEmbedNoticia(
      { title: "Evento", excerpt: "Detalles.", coverImage: null },
      "https://nova.example/noticias/evento",
    );

    expect(embed.description).toBe("Detalles.");
    expect(embed.footer?.text).toBe("Para leer más, entra en la web.");
  });

  it("con url de baja, la entradilla invita a desactivar el aviso con un enlace —solo tiene sentido en un privado, no en el canal", () => {
    const embed = construirEmbedNoticia(
      { title: "Evento", excerpt: "Detalles.", coverImage: null },
      "https://nova.example/noticias/evento",
      "https://nova.example/avisos/ajustes",
    );

    expect(embed.description).toBe(
      "Detalles.\n\nPara dejar de recibir este aviso, [entra aquí](https://nova.example/avisos/ajustes).",
    );
    expect(embed.footer).toBeUndefined();
  });

  it("gana a la hora que `enviarDM` le pone por defecto a todo embed", () => {
    const embed = construirEmbedNoticia(
      { title: "Evento", excerpt: "Detalles.", coverImage: null },
      "https://nova.example/noticias/evento",
    );

    // Así es como `enviarDM` monta el mensaje: una hora por defecto y el
    // embed encima. Si `construirEmbedNoticia` no trajera su propio
    // `timestamp: undefined`, esta hora sobreviviría.
    const mensaje = { timestamp: new Date().toISOString(), ...embed };
    expect(JSON.stringify(mensaje)).not.toContain("timestamp");
  });
});

describe("construirEmbedCanalNoticia", () => {
  const noticia = {
    title: "¡Tú decides tu propio camino!",
    excerpt: "NOVA",
    coverImage: "https://nova.example/uploads/banner.png",
  };
  const url = "https://nova.example/noticias/camino";

  it("lleva el título, la entradilla en cita y negrita, y la frase fija con el enlace", () => {
    const embed = construirEmbedCanalNoticia(noticia, url);

    expect(embed.title).toBe("¡Tú decides tu propio camino!");
    expect(embed.description).toBe(
      "> **NOVA**\n\n-# Podrás consultar el contenido completo del mensaje en nuestra [página web](https://nova.example/noticias/camino).",
    );
    expect(embed.image).toEqual({ url: "https://nova.example/uploads/banner.png" });
    expect(embed.color).toBe(EMBED_COLOR.neutral);
  });

  it("sin cabecera, pie ni enlace en el título", () => {
    const embed = construirEmbedCanalNoticia(noticia, url);

    expect(embed.author).toBeUndefined();
    expect(embed.footer).toBeUndefined();
    expect(embed.url).toBeUndefined();
  });

  it("cita cada línea de una entradilla de varias y descarta las vacías", () => {
    const embed = construirEmbedCanalNoticia({ ...noticia, excerpt: "Uno\n\n Dos " }, url);

    expect(embed.description?.startsWith("> **Uno**\n> **Dos**\n\n-#")).toBe(true);
  });

  it("sin portada no manda imagen", () => {
    expect(construirEmbedCanalNoticia({ ...noticia, coverImage: null }, url).image).toBeUndefined();
  });
});
