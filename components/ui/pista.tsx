import { cn } from "@/lib/utils";

/**
 * Nota que aparece al posar el ratón o al llegar con el tabulador.
 *
 * No usa el atributo `title` del navegador: ese dibuja un recuadro del sistema,
 * tarda casi un segundo en salir y no se puede alcanzar con el teclado. Este va
 * con los colores de la casa y sale al instante.
 */
export function Pista({
  texto,
  children,
  lado = "derecha",
  redonda = false,
}: {
  texto: string;
  children: React.ReactNode;
  /**
   * A la derecha cuando lo señalado está suelto —un retrato—; arriba cuando va
   * en una fila con más cosas al lado, como las insignias, o cuando el texto es
   * largo y necesita varias líneas.
   */
  lado?: "derecha" | "arriba";
  /** El foco sigue la forma de lo que envuelve: un avatar es un círculo. */
  redonda?: boolean;
}) {
  return (
    <span
      className={cn(
        "pista",
        lado === "arriba" && "pista--arriba",
        redonda && "pista--redonda",
      )}
      tabIndex={0}
    >
      {children}
      <span className="pista__globo" role="tooltip">
        {texto}
      </span>
    </span>
  );
}
