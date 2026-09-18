"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpcionDesplegable = { valor: string; etiqueta: string };

/**
 * Un <select> normal no se puede vestir: el desplegable que abre es del
 * sistema operativo y ni el radio ni el cristal del resto de la web se le
 * pueden aplicar por CSS. Esto hace lo mismo pero con nuestras propias
 * piezas (un <details>, como el menú de usuario), para que salga igual que
 * cualquier otro campo.
 *
 * Dos formas de usarlo:
 * - Suelto en un formulario normal: con `name`, lleva un input oculto que
 *   `new FormData(form)` recoge igual que a un <select>. Su valor arranca en
 *   `valorInicial` y vive dentro del propio componente.
 * - Controlado: pasando `valor` y `alCambiar`, para cuando elegir aquí tiene
 *   que decidir qué se enseña en otro sitio (p. ej. un segundo desplegable
 *   que depende del primero). En ese caso no hace falta `name`.
 */
export function Desplegable({
  id,
  name,
  opciones,
  valorInicial = "",
  valor: valorControlado,
  alCambiar,
  placeholder = "Elegir",
  disabled,
  className,
  ariaInvalid,
  ariaDescribedby,
}: {
  id?: string;
  name?: string;
  opciones: OpcionDesplegable[];
  valorInicial?: string;
  valor?: string;
  alCambiar?: (valor: string) => void;
  /** Se enseña cuando el valor actual no coincide con ninguna opción. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaInvalid?: boolean;
  ariaDescribedby?: string;
}) {
  const [interno, setInterno] = useState(valorInicial);
  const controlado = valorControlado !== undefined;
  const valor = controlado ? valorControlado : interno;
  const caja = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function alPulsarFuera(evento: MouseEvent) {
      const elemento = caja.current;
      if (!elemento?.open) return;
      if (!elemento.contains(evento.target as Node)) elemento.open = false;
    }

    function alEscapar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      if (caja.current?.open) caja.current.open = false;
    }

    document.addEventListener("click", alPulsarFuera);
    document.addEventListener("keydown", alEscapar);
    return () => {
      document.removeEventListener("click", alPulsarFuera);
      document.removeEventListener("keydown", alEscapar);
    };
  }, []);

  const actual = opciones.find((opcion) => opcion.valor === valor);

  function elegir(nuevo: string) {
    if (!controlado) setInterno(nuevo);
    alCambiar?.(nuevo);
    if (caja.current) caja.current.open = false;
  }

  return (
    <details ref={caja} className={cn("desplegable", className)}>
      {name ? <input type="hidden" name={name} value={valor} /> : null}

      <summary
        id={id}
        className="input desplegable__boton"
        aria-disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        onClick={(evento) => {
          if (disabled) evento.preventDefault();
        }}
      >
        <span className="min-w-0 truncate">{actual?.etiqueta ?? placeholder}</span>
        <ChevronDown size={16} className="desplegable__flecha shrink-0" aria-hidden />
      </summary>

      <div className="desplegable__panel" role="listbox">
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="option"
            aria-selected={opcion.valor === valor}
            className="desplegable__opcion"
            onClick={() => elegir(opcion.valor)}
          >
            <span className="min-w-0 truncate">{opcion.etiqueta}</span>
            {opcion.valor === valor ? (
              <Check size={14} className="shrink-0" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>
    </details>
  );
}
