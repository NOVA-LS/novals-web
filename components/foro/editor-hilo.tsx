"use client";

import { useState, useTransition } from "react";
import { crearHilo } from "@/lib/actions/foro";
import { CATEGORIAS } from "@/lib/foro/categorias";
import { Boton } from "@/components/ui/button";
import { Desplegable } from "@/components/ui/desplegable";

export function EditorHilo({ categoriaInicial }: { categoriaInicial: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    empezar(async () => {
      const resultado = await crearHilo(datos);
      // Si sale bien la acción redirige al hilo, así que llegar aquí es un fallo.
      if (resultado && !resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo publicar.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-[var(--space-lg)]">
      <div className="field">
        <label className="field__label" htmlFor="category">
          Categoría
        </label>
        <Desplegable
          id="category"
          name="category"
          valorInicial={categoriaInicial}
          disabled={enviando}
          opciones={CATEGORIAS.map((categoria) => ({
            valor: categoria.slug,
            etiqueta: categoria.nombre,
          }))}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="title">
          Título
        </label>
        <input
          id="title"
          name="title"
          className="input"
          maxLength={120}
          disabled={enviando}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="body">
          Mensaje
        </label>
        <p className="field__help">Acepta Markdown: **negrita**, listas y enlaces.</p>
        <textarea
          id="body"
          name="body"
          className="input text-sm"
          rows={12}
          maxLength={20000}
          disabled={enviando}
        />
      </div>

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Boton
          type="submit"
          variante="primary"
          className="btn--redondo"
          disabled={enviando}
          data-state={enviando ? "loading" : undefined}
        >
          {enviando ? "Publicando…" : "Publicar hilo"}
        </Boton>
      </div>
    </form>
  );
}
