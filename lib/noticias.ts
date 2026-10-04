import { z } from "zod";

/**
 * Validación de una noticia. Aparte de `lib/actions/posts.ts` porque ese
 * módulo importa `lib/db`, que revienta sin `DATABASE_URL`; así el esquema se
 * puede probar sin base de datos, igual que `lib/forms`.
 *
 * Ni el canal de Discord ni el aviso por privado son obligatorios: una noticia
 * puede publicarse solo en la web.
 */
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
});
