"use client";

import { useRef, useState, type ComponentProps } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "type" | "onChange" | "className"> & {
  className?: string;
};

/**
 * Un `<input type="file">` con su propio botón en vez del cartel nativo del
 * navegador («Seleccionar archivo · Ningún archivo seleccionado»): antes de
 * elegir nada dice solo «Seleccionar archivo», y en cuanto hay algo elegido
 * lo lista con una X para quitarlo —de uno en uno si son varios— sin tener
 * que reabrir el explorador para deshacerse de algo.
 *
 * El input real sigue en el DOM, oculto, y sigue siendo el que viaja en el
 * FormData: el botón solo le hace `.click()`. Al quitar un archivo se
 * reconstruye su `FileList` con `DataTransfer`, que es la única forma que da
 * el navegador de tocarla desde fuera.
 */
export function CampoArchivo({
  className,
  disabled,
  "aria-label": ariaLabel,
  ...resto
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);

  function alCambiar() {
    setArchivos(Array.from(inputRef.current?.files ?? []));
  }

  function quitar(indice: number) {
    const restantes = archivos.filter((_, i) => i !== indice);
    const transferencia = new DataTransfer();
    for (const archivo of restantes) transferencia.items.add(archivo);
    if (inputRef.current) inputRef.current.files = transferencia.files;
    setArchivos(restantes);
  }

  return (
    <div className="grid gap-[var(--space-2xs)]">
      {/* Oculto de verdad: el botón de abajo es lo único que se ve y lo único
          a lo que se llega con el tabulador. */}
      <input
        {...resto}
        ref={inputRef}
        type="file"
        disabled={disabled}
        onChange={alCambiar}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      />

      {archivos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("input flex items-center justify-start text-left", className)}
        >
          Seleccionar archivo
        </button>
      ) : (
        <ul className="grid gap-[var(--space-2xs)]">
          {archivos.map((archivo, indice) => (
            <li
              key={`${archivo.name}-${archivo.lastModified}-${indice}`}
              className="input flex items-center justify-between gap-[var(--space-sm)] py-[var(--space-xs)]"
            >
              <span className="min-w-0 truncate text-sm">{archivo.name}</span>
              <button
                type="button"
                onClick={() => quitar(indice)}
                disabled={disabled}
                aria-label={`Quitar ${archivo.name}`}
                className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                <X size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
