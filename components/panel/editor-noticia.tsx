"use client";

import { useEffect, useState, useTransition } from "react";
import { guardarNoticia, previsualizarMarkdown } from "@/lib/actions/posts";
import { MAX_IMAGEN_MB } from "@/lib/limites";
import { Boton } from "@/components/ui/button";

type Noticia = {
  id: string;
  title: string;
  excerpt: string;
  contentMd: string;
  published: boolean;
  coverImage: string | null;
};

export function EditorNoticia({ noticia }: { noticia?: Noticia }) {
  const [contenido, setContenido] = useState(noticia?.contentMd ?? "");
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  // Saneado en el servidor, con el mismo renderMarkdown que se usa al
  // publicar: nunca se inyecta el HTML crudo de marked en el navegador.
  useEffect(() => {
    if (!vistaPrevia || !contenido) return;

    let vigente = true;
    const espera = setTimeout(() => {
      previsualizarMarkdown(contenido).then((sano) => {
        if (vigente) setHtml(sano);
      });
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [contenido, vistaPrevia]);

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    empezar(async () => {
      const resultado = await guardarNoticia(noticia?.id ?? null, datos);
      // Si todo va bien la acción redirige, así que llegar aquí es un fallo.
      if (resultado && !resultado.ok) setError(resultado.mensaje ?? "No se pudo guardar.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-[var(--space-lg)]">
      <div className="field">
        <label className="field__label" htmlFor="title">
          Título
        </label>
        <input
          id="title"
          name="title"
          className="input"
          defaultValue={noticia?.title}
          maxLength={120}
          disabled={guardando}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="excerpt">
          Entradilla
        </label>
        <p className="field__help">Una o dos frases. Es lo que se ve en la portada.</p>
        <textarea
          id="excerpt"
          name="excerpt"
          className="input"
          rows={2}
          maxLength={300}
          defaultValue={noticia?.excerpt}
          disabled={guardando}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="coverImage">
          Portada
        </label>
        <p className="field__help">
          JPG, PNG o WEBP, hasta {MAX_IMAGEN_MB} MB.
          {noticia?.coverImage ? " Si no subes otra, se mantiene la actual." : ""}
        </p>
        <input
          id="coverImage"
          name="coverImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="input"
          disabled={guardando}
        />
      </div>

      <div className="field">
        <div className="flex items-center justify-between gap-[var(--space-sm)]">
          <label className="field__label" htmlFor="contentMd">
            Contenido (Markdown)
          </label>
          <Boton
            type="button"
            variante="ghost"
            onClick={() => setVistaPrevia((valor) => !valor)}
          >
            {vistaPrevia ? "Editar" : "Vista previa"}
          </Boton>
        </div>

        {vistaPrevia ? (
          <div
            className="tile prose"
            dangerouslySetInnerHTML={{
              __html: contenido ? html : "<p>Nada que previsualizar todavía.</p>",
            }}
          />
        ) : (
          <textarea
            id="contentMd"
            name="contentMd"
            className="input font-mono text-sm"
            rows={18}
            value={contenido}
            onChange={(evento) => setContenido(evento.target.value)}
            disabled={guardando}
          />
        )}
        {vistaPrevia ? (
          <input type="hidden" name="contentMd" value={contenido} />
        ) : null}
      </div>

      <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
        <input
          type="checkbox"
          name="published"
          defaultChecked={noticia?.published}
          disabled={guardando}
          className="size-4 accent-[var(--color-ink)]"
        />
        Publicada
      </label>

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Boton
          type="submit"
          variante="primary"
          disabled={guardando}
          data-state={guardando ? "loading" : undefined}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </form>
  );
}
