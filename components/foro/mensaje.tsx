"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { borrarRespuesta, editarRespuesta } from "@/lib/actions/foro";
import { FirmaAutor, type AutorConInsignias } from "@/components/foro/firma-autor";
import { Boton } from "@/components/ui/button";

/**
 * Un mensaje del foro.
 *
 * Recibe el HTML ya saneado en el servidor y, aparte, el texto original para
 * poder editarlo. Nunca se vuelve a construir HTML aquí.
 */
export function Mensaje({
  id,
  html,
  body,
  autor,
  fecha,
  editado,
  puedeEditar,
  puedeBorrar,
}: {
  id: string;
  html: string;
  body: string;
  autor: AutorConInsignias;
  fecha: string;
  editado: boolean;
  puedeEditar: boolean;
  puedeBorrar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(body);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  return (
    <article className="tile grid gap-[var(--space-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
        <FirmaAutor autor={autor} fecha={fecha} />

        <div className="flex gap-[var(--space-2xs)]">
          {puedeEditar ? (
            <Boton
              type="button"
              variante="ghost"
              aria-label="Editar mensaje"
              disabled={ocupado}
              onClick={() => {
                setError(null);
                setEditando((valor) => !valor);
              }}
            >
              <Pencil size={14} aria-hidden />
            </Boton>
          ) : null}

          {puedeBorrar ? (
            <Boton
              type="button"
              variante="ghost"
              aria-label="Borrar mensaje"
              disabled={ocupado}
              onClick={() => {
                if (!confirm("¿Borrar este mensaje?")) return;
                empezar(async () => {
                  const resultado = await borrarRespuesta(id);
                  if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo borrar.");
                });
              }}
            >
              <Trash2 size={14} aria-hidden />
            </Boton>
          ) : null}
        </div>
      </div>

      {editando ? (
        <div className="grid gap-[var(--space-sm)]">
          <textarea
            className="input text-sm"
            rows={6}
            maxLength={20000}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            disabled={ocupado}
            aria-label="Editar mensaje"
          />
          <div className="flex gap-[var(--space-xs)]">
            <Boton
              type="button"
              variante="primary"
              disabled={ocupado}
              onClick={() =>
                empezar(async () => {
                  const resultado = await editarRespuesta(id, texto);
                  if (resultado.ok) setEditando(false);
                  else setError(resultado.mensaje ?? "No se pudo guardar.");
                })
              }
            >
              Guardar
            </Boton>
            <Boton
              type="button"
              variante="ghost"
              disabled={ocupado}
              onClick={() => {
                setTexto(body);
                setEditando(false);
              }}
            >
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      )}

      {editado && !editando ? <span className="meta">Editado</span> : null}

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
