"use client";

import { useEffect, useState } from "react";
import { calcularEspera, type EstadoEspera } from "@/lib/cooldown";

const UNIDADES = [
  { clave: "dias", etiqueta: "Días" },
  { clave: "horas", etiqueta: "Horas" },
  { clave: "minutos", etiqueta: "Min" },
  { clave: "segundos", etiqueta: "Seg" },
] as const;

/**
 * Cuenta atrás hasta una fecha.
 *
 * El primer valor lo calcula el servidor y llega en `inicial`: así el número ya
 * está en el HTML, se ve sin JavaScript y la hidratación no encuentra dos
 * textos distintos. A partir de ahí lo refresca el navegador cada segundo.
 */
export function CuentaAtras({
  hasta,
  desde = null,
  inicial,
  variante = "completa",
}: {
  /** Marcas de tiempo en milisegundos: los objetos Date no cruzan al cliente. */
  hasta: number;
  desde?: number | null;
  inicial: EstadoEspera;
  /** «linea» cabe en una tarjeta; «completa» ocupa su propio hueco. */
  variante?: "completa" | "linea";
}) {
  const [vivo, setVivo] = useState<EstadoEspera | null>(null);

  useEffect(() => {
    const tic = setInterval(() => setVivo(calcularEspera(hasta, desde)), 1000);
    return () => clearInterval(tic);
  }, [hasta, desde]);

  const { desglose, avance, texto } = vivo ?? inicial;

  return (
    <div className="grid gap-[var(--space-sm)]">
      {/* Los lectores de pantalla oyen la frase entera, no cuatro números
          sueltos, y solo cuando el usuario llega hasta aquí. */}
      {variante === "linea" ? (
        <span
          className="display text-(length:--text-md) tabular-nums"
          role="timer"
          aria-label={`Queda ${texto}`}
        >
          {texto}
        </span>
      ) : (
        <div className="cifras" role="timer" aria-label={`Queda ${texto}`}>
          {UNIDADES.map(({ clave, etiqueta }) => (
            <div key={clave}>
              <span className="display text-(length:--text-2xl) tabular-nums" aria-hidden>
                {String(desglose[clave]).padStart(2, "0")}
              </span>
              <span className="meta" aria-hidden>
                {etiqueta}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="progreso"
        style={{ "--avance": `${Math.round(avance * 100)}%` } as React.CSSProperties}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(avance * 100)}
        aria-label="Espera cumplida"
      />
    </div>
  );
}
