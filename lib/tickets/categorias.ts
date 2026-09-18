import type { Field } from "@/lib/forms/types";
import type { Role } from "@/generated/prisma/enums";

/**
 * Los tipos de ticket que se pueden abrir.
 *
 * Cada uno nace en el escalón de staff que le toca: una duda entra por soporte y
 * una donación no la ve nadie por debajo de administración. Desde ahí puede
 * subir, que es de lo que va `lib/tickets/reglas.ts`.
 *
 * Las preguntas son las mismas `Field` de las solicitudes, así que validación,
 * dibujo y resumen salen del mismo sitio y no pueden desincronizarse.
 */
export type CategoriaTicket = {
  /** Se guarda en Ticket.category, así que no se cambia una vez usado. */
  clave: string;
  nombre: string;
  descripcion: string;
  /** Escalón que lo atiende al abrirse. */
  nivel: Role;
  /** Lo que se le dice a quien lo abre antes de rellenar nada. */
  aviso?: string;
  campos: Field[];
};

export const CATEGORIAS_TICKET: CategoriaTicket[] = [
  {
    clave: "duda",
    nombre: "Duda o ayuda",
    descripcion: "No sé cómo funciona algo, no me deja entrar, se me ha perdido algo.",
    nivel: "SOPORTE",
    campos: [
      {
        name: "asunto",
        kind: "text",
        label: "Resúmelo en una línea",
        minLength: 6,
        maxLength: 90,
        placeholder: "No puedo conectar desde ayer",
      },
      {
        name: "detalle",
        kind: "textarea",
        label: "Cuéntanoslo",
        minLength: 20,
        maxLength: 4000,
        rows: 6,
        help: "Cuanto más concreto, menos vueltas damos.",
      },
    ],
  },
  {
    clave: "historia",
    nombre: "Historia y whitelist",
    descripcion:
      "Corregir tu historia, revisar una whitelist o preguntar por qué se te rechazó.",
    nivel: "INICIADOR",
    campos: [
      {
        name: "asunto",
        kind: "text",
        label: "Resúmelo en una línea",
        minLength: 6,
        maxLength: 90,
        placeholder: "Dudas sobre el rechazo de mi whitelist",
      },
      {
        name: "sobre",
        kind: "select",
        label: "¿De qué va?",
        options: [
          { value: "whitelist", label: "Mi solicitud de whitelist" },
          { value: "historia", label: "La historia de mi personaje" },
          { value: "otro", label: "Otra cosa" },
        ],
      },
      {
        name: "detalle",
        kind: "textarea",
        label: "Cuéntanoslo",
        minLength: 20,
        maxLength: 4000,
        rows: 6,
      },
    ],
  },
  {
    clave: "reporte",
    nombre: "Reporte de jugador",
    descripcion: "Alguien ha roto el rol o la normativa dentro de la ciudad.",
    nivel: "MODERADOR",
    aviso:
      "Un reporte sin pruebas es difícil de resolver. Adjunta capturas o clips y di la hora aproximada.",
    campos: [
      {
        name: "asunto",
        kind: "text",
        label: "Resúmelo en una línea",
        minLength: 6,
        maxLength: 90,
        placeholder: "DM en el centro sobre las 22:30",
      },
      {
        name: "reportado",
        kind: "text",
        label: "¿A quién reportas?",
        minLength: 2,
        maxLength: 80,
        help: "Nombre del personaje, o de Discord si lo sabes.",
      },
      {
        name: "cuando",
        kind: "text",
        label: "¿Cuándo pasó?",
        maxLength: 60,
        placeholder: "Hoy sobre las 22:30",
      },
      {
        name: "detalle",
        kind: "textarea",
        label: "¿Qué pasó?",
        minLength: 30,
        maxLength: 4000,
        rows: 7,
        help: "Cuenta la escena entera, no solo el final.",
      },
      {
        name: "pruebas",
        kind: "textarea",
        label: "Pruebas",
        required: false,
        maxLength: 1000,
        rows: 3,
        help: "Enlaces a clips. Las capturas puedes adjuntarlas abajo.",
      },
    ],
  },
  {
    clave: "donacion",
    nombre: "Donaciones",
    descripcion: "Aportar al servidor, o un problema con un pago que ya hiciste.",
    nivel: "ADMIN",
    aviso:
      "No pongas aquí datos de tu tarjeta. Con la referencia del pago y la fecha nos basta.",
    campos: [
      {
        name: "asunto",
        kind: "text",
        label: "Resúmelo en una línea",
        minLength: 6,
        maxLength: 90,
        placeholder: "No me ha llegado lo del pago del día 3",
      },
      {
        name: "sobre",
        kind: "select",
        label: "¿De qué va?",
        options: [
          { value: "quiero_donar", label: "Quiero donar y no sé cómo" },
          { value: "no_llego", label: "Doné y no me ha llegado" },
          { value: "otro", label: "Otra cosa" },
        ],
      },
      {
        name: "referencia",
        kind: "text",
        label: "Referencia del pago",
        required: false,
        maxLength: 80,
        help: "El identificador que te dio la pasarela, si lo tienes.",
      },
      {
        name: "detalle",
        kind: "textarea",
        label: "Cuéntanoslo",
        minLength: 20,
        maxLength: 4000,
        rows: 6,
      },
    ],
  },
];

export function getCategoriaTicket(clave: string): CategoriaTicket | undefined {
  return CATEGORIAS_TICKET.find((categoria) => categoria.clave === clave);
}

/**
 * El asunto sale de la primera pregunta, que todas las categorías tienen.
 * Se guarda aparte para poder listar tickets sin abrir sus respuestas.
 */
export function asuntoDe(
  categoria: CategoriaTicket,
  respuestas: Record<string, unknown>,
): string {
  const texto = String(respuestas.asunto ?? "").trim();
  return texto || categoria.nombre;
}
