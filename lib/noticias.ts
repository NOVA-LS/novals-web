import { z } from "zod";
import { esquemaEncuesta } from "./encuesta";

/**
 * Validación de una noticia. Aparte de `lib/actions/posts.ts` porque ese
 * módulo importa `lib/db`, que revienta sin `DATABASE_URL`; así el esquema se
 * puede probar sin base de datos, igual que `lib/forms`.
 *
 * Ni el canal de Discord ni el aviso por privado son obligatorios: una noticia
 * puede publicarse solo en la web. La encuesta tampoco: sin ella la noticia se
 * guarda igual.
 */
/**
 * Si hay que mandar el aviso (canal y/o privado) al guardar o publicar.
 *
 * - Sin canal ni privado, o sin publicar, nunca.
 * - Si nunca se avisó, siempre: es la primera vez.
 * - Si ya se avisó, solo al volver a publicar una noticia que estaba en
 *   borrador y solo si quien publica pide expresamente avisar otra vez. Guardar
 *   cambios de una noticia que ya está publicada no reenvía nada.
 */
export function debeAvisar(datos: {
  publicando: boolean;
  estabaPublicada: boolean;
  yaAvisada: boolean;
  canal: boolean;
  privado: boolean;
  reavisar: boolean;
}) {
  if (!datos.publicando || !(datos.canal || datos.privado)) return false;
  if (!datos.yaAvisada) return true;
  return !datos.estabaPublicada && datos.reavisar;
}

export const esquemaNoticia = z.object({
  title: z.string().trim().min(3, "El título es demasiado corto.").max(120),
  excerpt: z.string().trim().min(10, "Escribe una entradilla.").max(300),
  contentMd: z.string().trim().min(20, "El contenido es demasiado corto."),
  published: z.coerce.boolean(),
  notificarPrivado: z.coerce.boolean(),
  channelId: z
    .string()
    .trim()
    .transform((valor) => (valor === "" ? undefined : valor))
    .optional(),
  roleId: z
    .string()
    .trim()
    .transform((valor) => (valor === "" ? undefined : valor))
    .optional(),
  encuesta: esquemaEncuesta.nullable().optional(),
});
