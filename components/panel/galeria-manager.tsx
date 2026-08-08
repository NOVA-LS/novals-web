"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { borrarFoto, editarPie, moverFoto, subirFotos } from "@/lib/actions/galeria";
import { MAX_FOTO_MB, MAX_IMAGENES_POR_TANDA } from "@/lib/limites";
import { Boton } from "@/components/ui/button";

export type FotoPanel = {
  id: string;
  url: string;
  width: number;
  height: number;
  caption: string | null;
};

export function GaleriaManager({ fotos }: { fotos: FotoPanel[] }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, empezarSubida] = useTransition();
  const [ocupado, empezarAccion] = useTransition();

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    empezarSubida(async () => {
      const resultado = await subirFotos(datos);
      if (resultado.ok) formulario.current?.reset();
      else setError(resultado.mensaje ?? "No se pudieron subir.");
    });
  }

  return (
    <div className="grid gap-[var(--space-xl)]">
      <form ref={formulario} onSubmit={onSubmit} className="tile grid gap-[var(--space-md)]">
        <div className="field">
          <label className="field__label" htmlFor="fotos">
            Añadir fotos
          </label>
          <p className="field__help">
            JPG, PNG o WEBP, hasta {MAX_FOTO_MB} MB cada una y{" "}
            {MAX_IMAGENES_POR_TANDA} por tanda.
          </p>
          <input
            id="fotos"
            name="fotos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="input"
            disabled={subiendo}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="caption">
            Pie de foto
          </label>
          <p className="field__help">
            Opcional, y solo se aplica cuando subes una sola imagen.
          </p>
          <input
            id="caption"
            name="caption"
            className="input"
            maxLength={140}
            disabled={subiendo}
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
            disabled={subiendo}
            data-state={subiendo ? "loading" : undefined}
          >
            <ImagePlus size={16} aria-hidden />
            {subiendo ? "Subiendo…" : "Subir"}
          </Boton>
        </div>
      </form>

      {fotos.length === 0 ? (
        <p className="text-[var(--color-muted)]">
          Todavía no hay fotos. Las que subas salen en la portada.
        </p>
      ) : (
        <ul className="grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
          {fotos.map((foto, indice) => (
            <li key={foto.id} className="tile grid content-start gap-[var(--space-sm)]">
              <Image
                src={foto.url}
                alt={foto.caption ?? ""}
                width={foto.width}
                height={foto.height}
                sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                className="aspect-video w-full rounded-[var(--radius-sm)] object-cover"
              />

              <input
                className="input text-sm"
                defaultValue={foto.caption ?? ""}
                maxLength={140}
                placeholder="Pie de foto"
                aria-label="Pie de foto"
                disabled={ocupado}
                onBlur={(evento) => {
                  const valor = evento.target.value;
                  if (valor.trim() === (foto.caption ?? "").trim()) return;
                  empezarAccion(() => editarPie(foto.id, valor));
                }}
              />

              <div className="flex items-center justify-between gap-[var(--space-xs)]">
                <div className="flex gap-[var(--space-2xs)]">
                  <Boton
                    type="button"
                    variante="ghost"
                    aria-label="Mover antes"
                    disabled={ocupado || indice === 0}
                    onClick={() => empezarAccion(() => moverFoto(foto.id, "arriba"))}
                  >
                    <ArrowUp size={16} aria-hidden />
                  </Boton>
                  <Boton
                    type="button"
                    variante="ghost"
                    aria-label="Mover después"
                    disabled={ocupado || indice === fotos.length - 1}
                    onClick={() => empezarAccion(() => moverFoto(foto.id, "abajo"))}
                  >
                    <ArrowDown size={16} aria-hidden />
                  </Boton>
                </div>

                <Boton
                  type="button"
                  variante="danger"
                  disabled={ocupado}
                  onClick={() => {
                    if (!confirm("¿Borrar esta foto? También se borra del disco.")) return;
                    empezarAccion(() => borrarFoto(foto.id));
                  }}
                >
                  <Trash2 size={16} aria-hidden />
                  Borrar
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
