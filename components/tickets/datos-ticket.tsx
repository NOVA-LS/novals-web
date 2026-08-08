import type { CategoriaTicket } from "@/lib/tickets/categorias";

/**
 * Lo que se rellenó al abrir el ticket, para pintarlo dentro del primer mensaje.
 *
 * No se enseña en una caja aparte: quien abre un ticket escribe una sola cosa, y
 * partirla en «ficha» arriba y «mensaje» abajo obliga a leer dos veces para
 * enterarse de una.
 *
 * Se dejan fuera dos campos: `asunto`, que ya es el título del ticket, y
 * `detalle`, que es el cuerpo del propio mensaje.
 */
export function DatosTicket({
  categoria,
  respuestas,
}: {
  categoria: CategoriaTicket;
  respuestas: Record<string, unknown>;
}) {
  const campos = categoria.campos.filter(
    (campo) => campo.name !== "detalle" && campo.name !== "asunto",
  );

  const visibles = campos
    .map((campo) => {
      const valor = respuestas[campo.name];
      const texto =
        campo.kind === "select"
          ? (campo.options.find((opcion) => opcion.value === valor)?.label ??
            String(valor ?? ""))
          : campo.kind === "checkbox"
            ? valor
              ? "Sí"
              : "No"
            : String(valor ?? "");

      return { nombre: campo.name, etiqueta: campo.label, texto: texto.trim() };
    })
    .filter((campo) => campo.texto !== "");

  if (visibles.length === 0) return null;

  return (
    <dl className="datos-ticket">
      {visibles.map((campo) => (
        <div key={campo.nombre}>
          <dt className="meta">{campo.etiqueta}</dt>
          <dd className="respuesta text-sm text-[var(--color-muted)]">
            {campo.texto}
          </dd>
        </div>
      ))}
    </dl>
  );
}
