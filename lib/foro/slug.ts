import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/utils";

/**
 * Crea una fila con un slug libre, reintentando si dos llegan a la vez con el
 * mismo candidato.
 *
 * Comprobar que un slug está libre y crearlo después no es una operación
 * atómica: entre lo uno y lo otro, otra petición puede haberlo tomado ya. Sin
 * esto, esa carrera se traduce en un error de restricción única sin capturar
 * —un 500 pelado— en vez de en el siguiente sufijo, que es lo que pasaría si
 * las dos peticiones hubieran llegado diez milisegundos más separadas.
 */
export async function conSlugLibre<T>(
  titulo: string,
  /** Base a partir de la cual generar candidatos si el título no da ninguna. */
  respaldo: string,
  libre: (slug: string) => Promise<boolean>,
  crear: (slug: string) => Promise<T>,
): Promise<T> {
  const base = slugify(titulo) || respaldo;
  let candidato = base;
  let intento = 1;

  while (true) {
    while (!(await libre(candidato))) {
      candidato = `${base}-${++intento}`;
    }

    try {
      return await crear(candidato);
    } catch (error) {
      if (!esColisionDeSlug(error)) throw error;
      candidato = `${base}-${++intento}`;
    }
  }
}

function esColisionDeSlug(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const objetivo = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(objetivo) && objetivo.includes("slug");
}
