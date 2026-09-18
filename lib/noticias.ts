import { z } from "zod";

/**
 * Validación de una noticia. Aparte de `lib/actions/posts.ts` porque ese
 * módulo importa `lib/db`, que revienta sin `DATABASE_URL`; así el esquema se
 * puede probar sin base de datos, igual que `lib/forms`.
 *
 * El canal de Discord solo hace falta si la noticia sale publicada: en
 * borrador se puede guardar sin haber elegido todavía dónde avisar.
 */
export const esquemaNoticia = z
  .object({
    title: z.string().trim().min(3, "El título es demasiado corto.").max(120),
    excerpt: z.string().trim().min(10, "Escribe una entradilla.").max(300),
    contentMd: z.string().trim().min(20, "El contenido es demasiado corto."),
    published: z.coerce.boolean(),
    channelId: z
      .string()
      .trim()
      .transform((valor) => (valor === "" ? undefined : valor))
      .optional(),
  })
  .refine((datos) => !datos.published || !!datos.channelId, {
    message: "Elige en qué canal de Discord se publica.",
    path: ["channelId"],
  });
