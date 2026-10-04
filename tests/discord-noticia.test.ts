import { describe, expect, it } from "vitest";
import { construirEmbedNoticia, construirMensajeCanalNoticia } from "@/lib/discord/noticia";
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

describe("construirMensajeCanalNoticia", () => {
  const noticia = {
    title: "¡Tú decides tu propio camino!",
    excerpt: "NOVA",
    coverImage: "https://nova.example/uploads/banner.png",
  };
  const url = "https://nova.example/noticias/camino";

  it("es un mensaje de componentes: ni `content` ni `embeds`", () => {
    const mensaje = construirMensajeCanalNoticia(noticia, url);

    expect(mensaje.flags).toBe(32768);
    expect(mensaje).not.toHaveProperty("content");
    expect(mensaje).not.toHaveProperty("embeds");
  });

  it("el contenedor lleva título, entradilla en cita y negrita con la frase fija, y la portada", () => {
    const [contenedor] = construirMensajeCanalNoticia(noticia, url).components;

    expect(contenedor).toEqual({
      type: 17,
      accent_color: EMBED_COLOR.neutral,
      components: [
        { type: 10, content: "## ¡Tú decides tu propio camino!" },
        {
          type: 10,
          content:
            "> **NOVA**\n\n-# Podrás consultar el contenido completo del mensaje en nuestra [página web](https://nova.example/noticias/camino).",
        },
        { type: 12, items: [{ media: { url: "https://nova.example/uploads/banner.png" } }] },
      ],
    });
  });

  it("sin portada no manda galería", () => {
    const [contenedor] = construirMensajeCanalNoticia({ ...noticia, coverImage: null }, url)
      .components;

    expect(JSON.stringify(contenedor)).not.toContain('"type":12');
  });

  it("cita cada línea de una entradilla de varias y descarta las vacías", () => {
    const [contenedor] = construirMensajeCanalNoticia({ ...noticia, excerpt: "Uno\n\n Dos " }, url)
      .components as { components: { content: string }[] }[];

    expect(contenedor.components[1].content.startsWith("> **Uno**\n> **Dos**\n\n-#")).toBe(true);
  });

  it("sin rol, no hay mención y no se permite mencionar a nadie", () => {
    const mensaje = construirMensajeCanalNoticia(noticia, url);

    expect(mensaje.components).toHaveLength(1);
    expect(mensaje.allowed_mentions).toEqual({ parse: [], roles: [] });
  });

  it("con rol, la mención tapada va debajo del contenedor y solo se permite ese rol", () => {
    const mensaje = construirMensajeCanalNoticia(noticia, url, "123456789012345678");

    expect(mensaje.components[1]).toEqual({ type: 10, content: "||<@&123456789012345678>||" });
    expect(mensaje.allowed_mentions).toEqual({ parse: [], roles: ["123456789012345678"] });
  });
});
