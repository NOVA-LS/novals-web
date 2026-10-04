# Noticias: eliminar, encuesta y apoyo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que solo `ADMIN` pueda eliminar noticias, que el creador de noticias permita añadir una encuesta opcional y que cada noticia tenga un botón de apoyo, ambos con sesión obligatoria para interactuar.

**Architecture:** Cuatro modelos Prisma nuevos (`PostPoll`, `PollOption`, `PollVote`, `PostSupport`) con cascade desde `Post`. Las reglas de la encuesta viven en `lib/encuesta.ts`, sin dependencia de la base de datos y probadas con vitest. Las acciones de servidor (`eliminarNoticia`, `guardarNoticia` ampliada, `votarEncuesta`, `alternarApoyo`) las usan, y la página pública lee votos y apoyos con una consulta sin caché, aparte de la noticia cacheada.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma 7 con SQLite (better-sqlite3), zod 4, vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-04-noticias-encuesta-apoyo-eliminar-design.md`

## Global Constraints

- Idioma de la interfaz, comentarios y mensajes de error: español, con tildes correctas.
- **No hacer `git commit` sin que el usuario lo pida explícitamente** (memoria del proyecto). Por eso este plan no tiene pasos de commit; cuando el usuario los pida: mensaje de una sola línea, sin cuerpo largo y sin firma `Co-Authored-By`.
- Un voto por usuario y encuesta (`@@unique([pollId, userId])`); un apoyo por usuario y noticia (`@@unique([postId, userId])`).
- Encuesta: de 2 a 6 opciones, opción de 1 a 80 caracteres, pregunta opcional de hasta 120, sin opciones repetidas (sin distinguir mayúsculas).
- Solo `ADMIN` elimina noticias. `requireUser("ADMIN")` se comprueba en la acción de servidor, no solo en la UI.
- Votar y apoyar exigen sesión (`requireUser()`); sin whitelist no hace falta. Resultados y contadores visibles sin sesión.
- Con votos emitidos, las opciones existentes no se pueden cambiar ni quitar; se pueden añadir, cambiar la fecha de cierre o desactivar la encuesta (borra los votos, con confirmación).
- Las acciones de servidor van en módulos con `"use server"` que solo exportan funciones `async`; los tipos y las constantes viven en módulos aparte.
- Lo que va en `unstable_cache` se serializa: nada de `Date` sin convertir.
- Verificación de cada tarea: `pnpm test`, `pnpm lint` y `pnpm exec tsc --noEmit` sin errores nuevos.

## Review Focus

1. Opción con `id` ajeno o inventado (formulario viejo o manipulado) → se rechaza, no se pierde la opción en silencio. Probado en la Tarea 2 (`cambiosPermitidos`).
2. Opciones repetidas que solo difieren en mayúsculas o espacios (`"Sí"`, `" sí "`) → se rechazan. Probado en la Tarea 2.
3. Votar en una encuesta cerrada o de una noticia despublicada → se rechaza, aunque la UI estuviera abierta de antes. Probado en la Tarea 2 (`puedeVotar`).
4. Fecha de cierre: `datetime-local` no lleva zona horaria, así que el cliente la manda ya en ISO; una fecha ya pasada se rechaza al crear la encuesta, pero se admite al editar (así se puede cerrar a mano). Probado en la Tarea 2 (`cierreValido`).
5. Encuesta con 0 votos → porcentaje 0 en todas las opciones, nunca `NaN`. Probado en la Tarea 2 (`porcentaje`).

---

## Estructura de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `prisma/schema.prisma` + migración | Modelos de encuesta, voto y apoyo |
| `lib/encuesta.ts` (nuevo) | Esquema zod, reglas puras, lectura del `FormData`. Sin `db` |
| `lib/noticias.ts` | `esquemaNoticia` acepta el bloque `encuesta` |
| `lib/interaccion.ts` (nuevo) | Consulta sin caché: votos, voto propio, apoyos |
| `lib/actions/interaccion.ts` (nuevo) | `votarEncuesta`, `alternarApoyo` |
| `lib/actions/posts.ts` | `eliminarNoticia`; `guardarNoticia` guarda la encuesta |
| `lib/consultas.ts` | `noticiaPorSlug` devuelve también `id` |
| `components/panel/eliminar-noticia.tsx` (nuevo) | Botón con confirmación en línea |
| `components/panel/editor-encuesta.tsx` (nuevo) | Interruptor y editor de opciones |
| `components/panel/editor-noticia.tsx` | Monta el editor de encuesta y convierte la fecha a ISO |
| `components/noticias/encuesta.tsx` (nuevo) | Encuesta pública |
| `components/noticias/boton-apoyo.tsx` (nuevo) | Botón de apoyo |
| `app/globals.css` | Estilos de encuesta y apoyo |
| `app/(panel)/panel/noticias/page.tsx` | Botón "Eliminar" |
| `app/(panel)/panel/noticias/[id]/page.tsx` | Carga la encuesta para el editor |
| `app/(public)/noticias/[slug]/page.tsx` | Pinta encuesta y apoyo al final |
| `tests/encuesta.test.ts` (nuevo), `tests/posts-esquema.test.ts` | Pruebas |

Dos desviaciones respecto a la spec, para que nadie se sorprenda:

- La confirmación de eliminar es **en línea** (primer clic muestra "¿Eliminar? Sí / No"), no un diálogo de Radix: el proyecto no tiene estilos de diálogo y no justifican una pieza nueva. Mismo efecto: no se borra a la primera.
- `votarEncuesta` recibe `(pollId, optionId | null)`, no solo `optionId`: para retirar el voto (`null`) hace falta saber de qué encuesta. La consulta de estado vive en `lib/interaccion.ts` y no en `lib/consultas.ts`, porque este último es solo de consultas cacheadas.

---

### Task 1: Modelos y migración

**Files:**
- Modify: `prisma/schema.prisma` (modelos `Post` ~línea 214, `User` ~línea 48; añadir modelos al final de `Post`)
- Create: `prisma/migrations/<marca de tiempo>_encuesta_y_apoyos/migration.sql` (lo genera Prisma)

**Interfaces:**
- Produces: modelos `PostPoll`, `PollOption`, `PollVote`, `PostSupport`; en el cliente `db.postPoll`, `db.pollOption`, `db.pollVote`, `db.postSupport`; claves únicas compuestas `pollId_userId` (en `pollVote`) y `postId_userId` (en `postSupport`).

- [ ] **Step 1: Añadir las relaciones a `Post`**

En `model Post`, justo antes de `createdAt   DateTime  @default(now())`, añadir:

```prisma
  poll        PostPoll?
  supports    PostSupport[]
```

- [ ] **Step 2: Añadir las relaciones a `User`**

En `model User`, tras `ticketMessages  TicketMessage[]`, añadir:

```prisma
  pollVotes       PollVote[]
  supports        PostSupport[]
```

- [ ] **Step 3: Añadir los modelos nuevos**

Justo después del cierre de `model Post { ... }`, añadir:

```prisma
/// Encuesta opcional de una noticia. Una por noticia.
model PostPoll {
  id        String       @id @default(cuid())
  postId    String       @unique
  post      Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
  /// Pregunta opcional; sin ella solo se muestran las opciones.
  question  String?
  /// Pasada esta fecha no se puede votar. Sin fecha, abierta mientras la
  /// noticia esté publicada.
  closesAt  DateTime?
  options   PollOption[]
  votes     PollVote[]
  createdAt DateTime     @default(now())
}

model PollOption {
  id       String     @id @default(cuid())
  pollId   String
  poll     PostPoll   @relation(fields: [pollId], references: [id], onDelete: Cascade)
  label    String
  position Int
  votes    PollVote[]

  @@index([pollId, position])
}

/// Un voto por usuario y encuesta: cambiar de opinión actualiza la fila.
model PollVote {
  id        String     @id @default(cuid())
  pollId    String
  poll      PostPoll   @relation(fields: [pollId], references: [id], onDelete: Cascade)
  optionId  String
  option    PollOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@unique([pollId, userId])
  @@index([optionId])
}

/// "Me gusta" de una noticia. Uno por usuario.
model PostSupport {
  id        String   @id @default(cuid())
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([postId, userId])
}
```

- [ ] **Step 4: Generar la migración**

Run: `pnpm prisma migrate dev --name encuesta_y_apoyos`
Expected: crea `prisma/migrations/2026…_encuesta_y_apoyos/migration.sql`, la aplica a `data/nova.db` y regenera el cliente en `generated/prisma`. (Si pide confirmar un reset de la base de datos, responder que **no** y avisar al usuario: no debería, la migración solo añade tablas.)

- [ ] **Step 5: Comprobar la migración**

Run: `ls prisma/migrations | tail -3 && grep -c "CREATE TABLE" prisma/migrations/*_encuesta_y_apoyos/migration.sql`
Expected: la carpeta nueva aparece **después** de `20261004160000_noticia_rol_mencion` y el recuento es `4`.

- [ ] **Step 6: Comprobar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

---

### Task 2: Reglas puras de la encuesta (TDD)

**Files:**
- Create: `lib/encuesta.ts`
- Create: `tests/encuesta.test.ts`
- Modify: `lib/noticias.ts`
- Modify: `tests/posts-esquema.test.ts`

**Interfaces:**
- Produces, todo en `lib/encuesta.ts`:
  - `MIN_OPCIONES = 2`, `MAX_OPCIONES = 6`, `MAX_ETIQUETA = 80`, `MAX_PREGUNTA = 120`
  - `esquemaEncuesta` (zod). Entrada `{ question?: string; closesAt?: string; options: { id?: string; label: string }[] }`; salida `EncuestaValida` = `{ question?: string; closesAt?: Date; options: { id?: string; label: string }[] }`
  - `type EncuestaValida`
  - `type Resultado = { ok: true } | { ok: false; mensaje: string }`
  - `encuestaAbierta(encuesta: { closesAt: Date | null }, ahora?: Date): boolean`
  - `puedeVotar(post: { published: boolean }, encuesta: { closesAt: Date | null }, ahora?: Date): Resultado`
  - `cierreValido(closesAt: Date | undefined, esNueva: boolean, ahora?: Date): boolean`
  - `cambiosPermitidos(actuales: { id: string; label: string }[], nuevas: { id?: string; label: string }[], hayVotos: boolean): Resultado`
  - `porcentaje(votos: number, total: number): number`
  - `leerEncuestaDelFormulario(datos: FormData): unknown | null`
- `lib/noticias.ts`: `esquemaNoticia` gana el campo `encuesta` (`EncuestaValida | null | undefined`).

- [ ] **Step 1: Escribir las pruebas**

Crear `tests/encuesta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cambiosPermitidos,
  cierreValido,
  encuestaAbierta,
  esquemaEncuesta,
  leerEncuestaDelFormulario,
  porcentaje,
  puedeVotar,
} from "@/lib/encuesta";

const AHORA = new Date("2026-10-04T12:00:00Z");
const FUTURO = new Date("2026-10-10T12:00:00Z");
const PASADO = new Date("2026-10-01T12:00:00Z");

describe("esquemaEncuesta", () => {
  it("acepta dos opciones y deja la pregunta y el cierre sin rellenar", () => {
    const resultado = esquemaEncuesta.safeParse({
      question: "",
      closesAt: "",
      options: [{ label: "Sí" }, { label: "No" }],
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.question).toBeUndefined();
    expect(resultado.data?.closesAt).toBeUndefined();
  });

  it("convierte la fecha de cierre en Date", () => {
    const resultado = esquemaEncuesta.safeParse({
      closesAt: "2026-10-10T12:00:00.000Z",
      options: [{ label: "Sí" }, { label: "No" }],
    });
    expect(resultado.data?.closesAt?.toISOString()).toBe("2026-10-10T12:00:00.000Z");
  });

  it("rechaza una fecha que no lo es", () => {
    const resultado = esquemaEncuesta.safeParse({
      closesAt: "mañana",
      options: [{ label: "Sí" }, { label: "No" }],
    });
    expect(resultado.success).toBe(false);
  });

  it("rechaza una sola opción", () => {
    const resultado = esquemaEncuesta.safeParse({ options: [{ label: "Sí" }] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("La encuesta necesita al menos 2 opciones.");
  });

  it("rechaza más de seis opciones", () => {
    const opciones = Array.from({ length: 7 }, (_, i) => ({ label: `Opción ${i}` }));
    expect(esquemaEncuesta.safeParse({ options: opciones }).success).toBe(false);
  });

  it("rechaza una opción vacía o demasiado larga", () => {
    expect(
      esquemaEncuesta.safeParse({ options: [{ label: "  " }, { label: "No" }] }).success,
    ).toBe(false);
    expect(
      esquemaEncuesta.safeParse({ options: [{ label: "a".repeat(81) }, { label: "No" }] })
        .success,
    ).toBe(false);
  });

  it("rechaza opciones repetidas aunque cambien las mayúsculas o los espacios", () => {
    const resultado = esquemaEncuesta.safeParse({
      options: [{ label: "Sí" }, { label: " sí " }],
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("Hay opciones repetidas.");
  });

  it("trata el id vacío como opción nueva", () => {
    const resultado = esquemaEncuesta.safeParse({
      options: [{ id: "", label: "Sí" }, { id: "abc", label: "No" }],
    });
    expect(resultado.data?.options[0].id).toBeUndefined();
    expect(resultado.data?.options[1].id).toBe("abc");
  });
});

describe("encuestaAbierta", () => {
  it("está abierta sin fecha de cierre", () => {
    expect(encuestaAbierta({ closesAt: null }, AHORA)).toBe(true);
  });
  it("está abierta con el cierre en el futuro", () => {
    expect(encuestaAbierta({ closesAt: FUTURO }, AHORA)).toBe(true);
  });
  it("está cerrada con el cierre en el pasado", () => {
    expect(encuestaAbierta({ closesAt: PASADO }, AHORA)).toBe(false);
  });
});

describe("puedeVotar", () => {
  it("deja votar en una encuesta abierta de una noticia publicada", () => {
    expect(puedeVotar({ published: true }, { closesAt: null }, AHORA)).toEqual({ ok: true });
  });
  it("no deja votar si la noticia está despublicada", () => {
    const resultado = puedeVotar({ published: false }, { closesAt: null }, AHORA);
    expect(resultado.ok).toBe(false);
  });
  it("no deja votar si la encuesta está cerrada", () => {
    const resultado = puedeVotar({ published: true }, { closesAt: PASADO }, AHORA);
    expect(resultado).toEqual({ ok: false, mensaje: "La encuesta está cerrada." });
  });
});

describe("cierreValido", () => {
  it("sin fecha siempre vale", () => {
    expect(cierreValido(undefined, true, AHORA)).toBe(true);
  });
  it("una encuesta nueva no puede nacer cerrada", () => {
    expect(cierreValido(PASADO, true, AHORA)).toBe(false);
    expect(cierreValido(FUTURO, true, AHORA)).toBe(true);
  });
  it("una encuesta existente sí puede cerrarse a mano con una fecha pasada", () => {
    expect(cierreValido(PASADO, false, AHORA)).toBe(true);
  });
});

describe("cambiosPermitidos", () => {
  const actuales = [
    { id: "a", label: "Sí" },
    { id: "b", label: "No" },
  ];

  it("sin votos deja cambiar, quitar y añadir", () => {
    const nuevas = [{ id: "a", label: "Claro" }, { label: "Quizá" }];
    expect(cambiosPermitidos(actuales, nuevas, false)).toEqual({ ok: true });
  });

  it("con votos deja añadir una opción nueva", () => {
    const nuevas = [...actuales, { label: "Quizá" }];
    expect(cambiosPermitidos(actuales, nuevas, true)).toEqual({ ok: true });
  });

  it("con votos no deja cambiar el texto de una opción", () => {
    const nuevas = [{ id: "a", label: "Claro" }, actuales[1]];
    const resultado = cambiosPermitidos(actuales, nuevas, true);
    expect(resultado.ok).toBe(false);
  });

  it("con votos no deja quitar una opción", () => {
    const resultado = cambiosPermitidos(actuales, [actuales[0], { label: "Otra" }], true);
    expect(resultado.ok).toBe(false);
  });

  it("rechaza un id que no es de esta encuesta, con o sin votos", () => {
    const nuevas = [{ id: "zzz", label: "Sí" }, { label: "No" }];
    expect(cambiosPermitidos(actuales, nuevas, false).ok).toBe(false);
    expect(cambiosPermitidos(actuales, nuevas, true).ok).toBe(false);
  });

  it("una encuesta nueva no admite ids", () => {
    expect(cambiosPermitidos([], [{ id: "a", label: "Sí" }, { label: "No" }], false).ok).toBe(
      false,
    );
  });
});

describe("porcentaje", () => {
  it("con cero votos en total da 0, no NaN", () => {
    expect(porcentaje(0, 0)).toBe(0);
  });
  it("redondea al entero más cercano", () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
    expect(porcentaje(3, 3)).toBe(100);
  });
});

describe("leerEncuestaDelFormulario", () => {
  it("devuelve null si el interruptor no está activado", () => {
    const datos = new FormData();
    datos.append("pollOptionLabel", "Sí");
    expect(leerEncuestaDelFormulario(datos)).toBeNull();
  });

  it("empareja cada id con su texto por posición", () => {
    const datos = new FormData();
    datos.append("pollEnabled", "on");
    datos.append("pollQuestion", "¿Os gusta?");
    datos.append("pollClosesAt", "2026-10-10T12:00:00.000Z");
    datos.append("pollOptionId", "a");
    datos.append("pollOptionLabel", "Sí");
    datos.append("pollOptionId", "");
    datos.append("pollOptionLabel", "No");

    expect(leerEncuestaDelFormulario(datos)).toEqual({
      question: "¿Os gusta?",
      closesAt: "2026-10-10T12:00:00.000Z",
      options: [
        { id: "a", label: "Sí" },
        { id: "", label: "No" },
      ],
    });
  });
});
```

Añadir al final de `tests/posts-esquema.test.ts`, dentro del `describe("esquemaNoticia", ...)` (antes del `});` final):

```ts

  it("deja guardar una noticia sin encuesta", () => {
    const resultado = esquemaNoticia.safeParse({ ...BASE, published: true, encuesta: null });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.encuesta).toBeNull();
  });

  it("valida la encuesta cuando viene", () => {
    const buena = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      encuesta: { options: [{ label: "Sí" }, { label: "No" }] },
    });
    expect(buena.success).toBe(true);

    const mala = esquemaNoticia.safeParse({
      ...BASE,
      published: true,
      encuesta: { options: [{ label: "Sí" }] },
    });
    expect(mala.success).toBe(false);
  });
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `pnpm test -- tests/encuesta.test.ts tests/posts-esquema.test.ts`
Expected: FAIL (`Failed to resolve import "@/lib/encuesta"` y, en el segundo archivo, las pruebas de `encuesta` fallan).

- [ ] **Step 3: Implementar `lib/encuesta.ts`**

```ts
import { z } from "zod";

/**
 * Reglas de la encuesta de una noticia. Aparte de las acciones porque aquí no
 * entra `lib/db`, que revienta sin `DATABASE_URL`: así se prueban sin base de
 * datos, igual que `lib/noticias`.
 */

export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 6;
export const MAX_ETIQUETA = 80;
export const MAX_PREGUNTA = 120;

export type Resultado = { ok: true } | { ok: false; mensaje: string };

export const esquemaEncuesta = z.object({
  question: z
    .string()
    .trim()
    .max(MAX_PREGUNTA, `La pregunta admite ${MAX_PREGUNTA} caracteres como máximo.`)
    .transform((valor) => (valor === "" ? undefined : valor))
    .optional(),
  // `datetime-local` no lleva zona horaria: el editor la manda ya en ISO.
  closesAt: z
    .string()
    .trim()
    .refine(
      (valor) => valor === "" || !Number.isNaN(Date.parse(valor)),
      "La fecha de cierre no es válida.",
    )
    .transform((valor) => (valor === "" ? undefined : new Date(valor)))
    .optional(),
  options: z
    .array(
      z.object({
        // Vacío = opción nueva, todavía sin guardar.
        id: z
          .string()
          .trim()
          .optional()
          .transform((valor) => (valor ? valor : undefined)),
        label: z
          .string()
          .trim()
          .min(1, "Las opciones no pueden estar vacías.")
          .max(MAX_ETIQUETA, `Una opción admite ${MAX_ETIQUETA} caracteres como máximo.`),
      }),
    )
    .min(MIN_OPCIONES, `La encuesta necesita al menos ${MIN_OPCIONES} opciones.`)
    .max(MAX_OPCIONES, `La encuesta admite ${MAX_OPCIONES} opciones como máximo.`)
    .refine(
      (opciones) =>
        new Set(opciones.map((opcion) => opcion.label.toLowerCase())).size === opciones.length,
      "Hay opciones repetidas.",
    ),
});

export type EncuestaValida = z.output<typeof esquemaEncuesta>;

/** Abierta mientras no haya fecha de cierre o esta no haya llegado. */
export function encuestaAbierta(encuesta: { closesAt: Date | null }, ahora = new Date()) {
  return !encuesta.closesAt || encuesta.closesAt.getTime() > ahora.getTime();
}

export function puedeVotar(
  post: { published: boolean },
  encuesta: { closesAt: Date | null },
  ahora = new Date(),
): Resultado {
  if (!post.published) return { ok: false, mensaje: "Esta noticia no está publicada." };
  if (!encuestaAbierta(encuesta, ahora)) return { ok: false, mensaje: "La encuesta está cerrada." };
  return { ok: true };
}

/**
 * Una encuesta nueva no puede nacer ya cerrada; una que ya existe sí admite una
 * fecha pasada, que es la forma de cerrarla a mano.
 */
export function cierreValido(closesAt: Date | undefined, esNueva: boolean, ahora = new Date()) {
  if (!closesAt || !esNueva) return true;
  return closesAt.getTime() > ahora.getTime();
}

/**
 * Qué cambios admite una encuesta ya guardada. Sin votos, cualquiera. Con votos,
 * las opciones que existen no se tocan —cambiarles el texto o quitarlas
 * falsearía los resultados— y solo se pueden añadir otras nuevas.
 */
export function cambiosPermitidos(
  actuales: { id: string; label: string }[],
  nuevas: { id?: string; label: string }[],
  hayVotos: boolean,
): Resultado {
  const conocidas = new Map(actuales.map((opcion) => [opcion.id, opcion.label]));

  // Un id que no es de esta encuesta (formulario viejo o manipulado) no se
  // ignora: la opción se perdería sin que nadie se enterase.
  if (nuevas.some((opcion) => opcion.id !== undefined && !conocidas.has(opcion.id))) {
    return { ok: false, mensaje: "La encuesta ha cambiado. Recarga la página e inténtalo otra vez." };
  }

  if (!hayVotos) return { ok: true };

  for (const actual of actuales) {
    const nueva = nuevas.find((opcion) => opcion.id === actual.id);
    if (!nueva) {
      return { ok: false, mensaje: "Con votos emitidos no se pueden quitar opciones." };
    }
    if (nueva.label.trim() !== actual.label) {
      return { ok: false, mensaje: "Con votos emitidos no se pueden cambiar las opciones." };
    }
  }

  return { ok: true };
}

/** Entero redondeado; con cero votos en total, 0 en lugar de `NaN`. */
export function porcentaje(votos: number, total: number) {
  return total === 0 ? 0 : Math.round((votos * 100) / total);
}

/**
 * Lo que manda el editor, sin validar todavía: `null` si el interruptor está
 * apagado. Los ids y los textos de las opciones llegan en dos listas paralelas.
 */
export function leerEncuestaDelFormulario(datos: FormData) {
  if (datos.get("pollEnabled") !== "on") return null;

  const ids = datos.getAll("pollOptionId").map(String);
  const textos = datos.getAll("pollOptionLabel").map(String);

  return {
    question: String(datos.get("pollQuestion") ?? ""),
    closesAt: String(datos.get("pollClosesAt") ?? ""),
    options: textos.map((label, indice) => ({ id: ids[indice] ?? "", label })),
  };
}
```

- [ ] **Step 4: Conectar `esquemaNoticia`**

En `lib/noticias.ts`, añadir la importación tras `import { z } from "zod";`:

```ts
import { esquemaEncuesta } from "./encuesta";
```

y, dentro de `z.object({ ... })`, tras el campo `roleId`:

```ts
  encuesta: esquemaEncuesta.nullable().optional(),
```

Actualizar el comentario del archivo añadiendo al final del bloque: ` * La encuesta es opcional: sin ella la noticia se guarda igual.`

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `pnpm test -- tests/encuesta.test.ts tests/posts-esquema.test.ts`
Expected: PASS en todas.

- [ ] **Step 6: Suite completa y tipos**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: todo verde.

---

### Task 3: Eliminar noticia (solo ADMIN)

**Files:**
- Modify: `lib/actions/posts.ts` (imports ~línea 3-16; añadir función al final)
- Create: `components/panel/eliminar-noticia.tsx`
- Modify: `app/(panel)/panel/noticias/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `borrarImagen` (`lib/uploads`), `apuntar` y `ACCIONES.CONTENIDO` (`lib/auditoria`), `ETIQUETA` (`lib/consultas`).
- Produces: `eliminarNoticia(id: string): Promise<ResultadoNoticia>` (`ResultadoNoticia` ya existe en `posts.ts`); componente `EliminarNoticia({ id, titulo })`.

- [ ] **Step 1: Importar `borrarImagen`**

En `lib/actions/posts.ts`, cambiar

```ts
import { guardarImagen } from "@/lib/uploads";
```

por

```ts
import { borrarImagen, guardarImagen } from "@/lib/uploads";
```

- [ ] **Step 2: Añadir la acción**

Al final de `lib/actions/posts.ts`:

```ts
/**
 * Borrado definitivo, solo para `ADMIN`. La encuesta, los votos y los apoyos
 * caen con la noticia (cascade). La portada se borra del disco al final y sin
 * que un fallo ahí deshaga nada: sobra un fichero, no un registro.
 */
export async function eliminarNoticia(id: string): Promise<ResultadoNoticia> {
  const actor = await requireUser("ADMIN");

  const noticia = await db.post.findUnique({
    where: { id },
    select: { slug: true, title: true, coverImage: true },
  });
  if (!noticia) return { ok: false, mensaje: "Esa noticia ya no existe." };

  await db.post.delete({ where: { id } });
  if (noticia.coverImage) await borrarImagen(noticia.coverImage);

  await apuntar({
    accion: ACCIONES.CONTENIDO,
    actor,
    objetivo: `Noticia «${noticia.title}»`,
    detalle: "Eliminada",
  });

  updateTag(ETIQUETA.noticias);
  revalidatePath("/");
  revalidatePath("/noticias");
  revalidatePath(`/noticias/${noticia.slug}`);
  revalidatePath("/panel/noticias");
  return { ok: true };
}
```

- [ ] **Step 3: Crear el botón**

Crear `components/panel/eliminar-noticia.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { eliminarNoticia } from "@/lib/actions/posts";
import { Boton } from "@/components/ui/button";

/**
 * Dos pasos en la propia fila: el primer clic no borra, pide confirmar. La
 * acción vuelve a comprobar el rol en el servidor; esto solo evita el clic
 * por descuido.
 */
export function EliminarNoticia({ id, titulo }: { id: string; titulo: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, empezar] = useTransition();

  function confirmar() {
    setError(null);
    empezar(async () => {
      const resultado = await eliminarNoticia(id);
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo eliminar.");
        setConfirmando(false);
      }
    });
  }

  if (!confirmando) {
    return (
      <div className="grid gap-[var(--space-2xs)]">
        <Boton type="button" variante="danger" onClick={() => setConfirmando(true)}>
          Eliminar
        </Boton>
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-[var(--space-xs)]"
      role="alertdialog"
      aria-label={`Confirmar la eliminación de ${titulo}`}
    >
      <span className="text-sm text-[var(--color-muted)]">
        ¿Eliminar «{titulo}»? Se borran también su encuesta y sus apoyos.
      </span>
      <Boton type="button" variante="danger" disabled={borrando} onClick={confirmar}>
        {borrando ? "Eliminando…" : "Sí, eliminar"}
      </Boton>
      <Boton type="button" variante="ghost" disabled={borrando} onClick={() => setConfirmando(false)}>
        Cancelar
      </Boton>
    </div>
  );
}
```

- [ ] **Step 4: Mostrarlo en la lista del panel**

En `app/(panel)/panel/noticias/page.tsx`:

Añadir la importación junto a las de `components/panel`:

```tsx
import { EliminarNoticia } from "@/components/panel/eliminar-noticia";
```

Cambiar `await requireUser("ADMIN");` por:

```tsx
  const usuario = await requireUser("ADMIN");
```

y, dentro del `<div className="flex flex-wrap gap-[var(--space-xs)]">`, tras el `</form>` de publicar/despublicar, añadir:

```tsx
                {usuario.role === "ADMIN" ? (
                  <EliminarNoticia id={noticia.id} titulo={noticia.title} />
                ) : null}
```

- [ ] **Step 5: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sin errores.

Comprobación manual (con `pnpm dev`, sesión de ADMIN): en `/panel/noticias` sale "Eliminar" en rojo; el primer clic pide confirmar y "Cancelar" lo deshace; "Sí, eliminar" quita la fila y la noticia ya no está en `/noticias`. Hacerlo con una noticia de prueba, **no** con "Comunicado oficial".

---

### Task 4: `guardarNoticia` guarda la encuesta

**Files:**
- Modify: `lib/actions/posts.ts` (imports; función `guardarNoticia` ~líneas 134-255; función auxiliar nueva)

**Interfaces:**
- Consumes: de `lib/encuesta.ts`: `cambiosPermitidos`, `cierreValido`, `leerEncuestaDelFormulario`, `type EncuestaValida`.
- Produces: `guardarNoticia` entiende los campos `pollEnabled`, `pollQuestion`, `pollClosesAt` (ISO), `pollOptionId` y `pollOptionLabel` (repetidos y paralelos).

- [ ] **Step 1: Importar**

En `lib/actions/posts.ts`, bajo `import { esquemaNoticia } from "@/lib/noticias";`:

```ts
import {
  cambiosPermitidos,
  cierreValido,
  leerEncuestaDelFormulario,
  type EncuestaValida,
} from "@/lib/encuesta";
```

- [ ] **Step 2: Añadir `sincronizarEncuesta`**

Justo antes de `export async function guardarNoticia(`:

```ts
/**
 * Deja la encuesta de la noticia como pide el editor. Sin encuesta, borra la
 * que hubiera (con sus votos). Los ids que llegan ya se comprobaron contra la
 * encuesta guardada en `cambiosPermitidos`; aun así cada escritura filtra por
 * `pollId`, así que un id ajeno nunca toca otra encuesta.
 *
 * Sin transacción interactiva: el proyecto no usa ninguna con el adaptador de
 * SQLite. Las escrituras de opciones van en un lote.
 */
async function sincronizarEncuesta(postId: string, encuesta: EncuestaValida | null) {
  if (!encuesta) {
    await db.postPoll.deleteMany({ where: { postId } });
    return;
  }

  const poll = await db.postPoll.upsert({
    where: { postId },
    create: { postId, question: encuesta.question, closesAt: encuesta.closesAt },
    update: { question: encuesta.question ?? null, closesAt: encuesta.closesAt ?? null },
    select: { id: true },
  });

  const conservadas = encuesta.options.flatMap((opcion) => (opcion.id ? [opcion.id] : []));

  await db.$transaction([
    db.pollOption.deleteMany({ where: { pollId: poll.id, id: { notIn: conservadas } } }),
    ...encuesta.options.map((opcion, posicion) =>
      opcion.id
        ? db.pollOption.updateMany({
            where: { id: opcion.id, pollId: poll.id },
            data: { label: opcion.label, position: posicion },
          })
        : db.pollOption.create({
            data: { pollId: poll.id, label: opcion.label, position: posicion },
          }),
    ),
  ]);
}
```

- [ ] **Step 3: Leer el bloque en el parseo**

En `guardarNoticia`, dentro de `esquemaNoticia.safeParse({ ... })`, tras `roleId: datos.get("roleId") ?? "",` añadir:

```ts
    encuesta: leerEncuestaDelFormulario(datos),
```

- [ ] **Step 4: Validar la encuesta antes de escribir nada**

Justo después del bloque `if (!parsed.success) { return ... }` y **antes** de `let portada: Portada | undefined;` (así un fallo no deja la portada subida a medias), añadir:

```ts
  // La encuesta guardada se lee antes de escribir nada: si el cambio no vale,
  // la noticia tampoco se toca.
  const encuestaPrevia = id
    ? await db.postPoll.findUnique({
        where: { postId: id },
        select: {
          options: { orderBy: { position: "asc" }, select: { id: true, label: true } },
          _count: { select: { votes: true } },
        },
      })
    : null;

  const encuestaNueva = parsed.data.encuesta ?? null;
  if (encuestaNueva) {
    if (!cierreValido(encuestaNueva.closesAt, !encuestaPrevia)) {
      return { ok: false, mensaje: "La fecha de cierre de la encuesta ya ha pasado." };
    }

    const cambios = cambiosPermitidos(
      encuestaPrevia?.options ?? [],
      encuestaNueva.options,
      (encuestaPrevia?._count.votes ?? 0) > 0,
    );
    if (!cambios.ok) return { ok: false, mensaje: cambios.mensaje };
  }
```

- [ ] **Step 5: Sacar `encuesta` de `campos`**

`campos` se esparce dentro de `db.post.update/create` y de `avisarPublicacion`; si lleva `encuesta`, Prisma revienta. Cambiar

```ts
  const { channelId, roleId: rol, ...campos } = parsed.data;
```

por

```ts
  const { channelId, roleId: rol, encuesta, ...campos } = parsed.data;
```

(`encuesta` queda sin usar a propósito: ya se leyó como `encuestaNueva`. Si ESLint se queja de variable sin usar, renombrar a `encuesta: _encuesta` y añadir `// eslint-disable-next-line @typescript-eslint/no-unused-vars` encima.)

- [ ] **Step 6: Guardar la encuesta tras guardar la noticia**

En la rama `if (id) { ... }`, dejar el `await db.post.update(...)` como está y añadir justo después de su `});`, antes de `if (avisar) {`:

```ts
    await sincronizarEncuesta(id, encuestaNueva);
```

En la rama `else { ... }`, cambiar `await db.post.create({` por `const creada = await db.post.create({`, añadir `select: { id: true },` como último campo del objeto (junto a `data`), es decir:

```ts
    const creada = await db.post.create({
      data: {
        ...campos,
        // (… campos que ya hay, sin cambios …)
      },
      select: { id: true },
    });

    await sincronizarEncuesta(creada.id, encuestaNueva);
```

- [ ] **Step 7: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sin errores; las pruebas siguen verdes.

---

### Task 5: Editor de la encuesta en el creador de noticias

**Files:**
- Create: `components/panel/editor-encuesta.tsx`
- Modify: `components/panel/editor-noticia.tsx`
- Modify: `app/(panel)/panel/noticias/[id]/page.tsx`

**Interfaces:**
- Consumes: `MAX_OPCIONES`, `MIN_OPCIONES`, `MAX_ETIQUETA`, `MAX_PREGUNTA` de `lib/encuesta.ts`; campos de formulario de la Tarea 4.
- Produces: `type EncuestaGuardada = { question: string | null; closesAt: string | null; options: { id: string; label: string }[]; votos: number }` y `EditorEncuesta({ encuesta, disabled })`, exportados de `components/panel/editor-encuesta.tsx`.

- [ ] **Step 1: Crear `components/panel/editor-encuesta.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MAX_ETIQUETA, MAX_OPCIONES, MAX_PREGUNTA, MIN_OPCIONES } from "@/lib/encuesta";
import { Boton } from "@/components/ui/button";

export type EncuestaGuardada = {
  question: string | null;
  /** ISO. Se convierte a hora local solo aquí, en el navegador. */
  closesAt: string | null;
  options: { id: string; label: string }[];
  votos: number;
};

type Fila = { clave: string; id: string; label: string };

/** Valor de un `datetime-local` en la hora del navegador. */
function aValorLocal(iso: string | null) {
  if (!iso) return "";
  const fecha = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

let contador = 0;
const claveNueva = () => `nueva-${++contador}`;

/**
 * Interruptor y opciones de la encuesta. Solo rellena campos del formulario del
 * editor (`pollEnabled`, `pollQuestion`, `pollClosesAt`, `pollOptionId`,
 * `pollOptionLabel`); la conversión de la fecha a ISO la hace el editor al
 * enviar. Con votos, las opciones que ya existen quedan de solo lectura (con
 * `readOnly`, no `disabled`, para que sigan enviándose): el servidor lo exige
 * igualmente.
 */
export function EditorEncuesta({
  encuesta,
  disabled,
}: {
  encuesta: EncuestaGuardada | null;
  disabled: boolean;
}) {
  const [activa, setActiva] = useState(encuesta !== null);
  const [filas, setFilas] = useState<Fila[]>(() =>
    encuesta
      ? encuesta.options.map((opcion) => ({ clave: opcion.id, id: opcion.id, label: opcion.label }))
      : [
          { clave: claveNueva(), id: "", label: "" },
          { clave: claveNueva(), id: "", label: "" },
        ],
  );
  const hayVotos = (encuesta?.votos ?? 0) > 0;

  function alternar(valor: boolean) {
    // Apagarla con votos los borra: se pide confirmar antes.
    if (!valor && hayVotos && !window.confirm(
      `Esta encuesta ya tiene ${encuesta?.votos} voto(s). Si la quitas, se pierden. ¿Quitarla?`,
    )) {
      return;
    }
    setActiva(valor);
  }

  return (
    <div className="field">
      <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
        <input
          type="checkbox"
          name="pollEnabled"
          checked={activa}
          onChange={(evento) => alternar(evento.target.checked)}
          disabled={disabled}
          className="size-4 accent-[var(--color-ink)]"
        />
        Añadir una encuesta al final de la noticia
      </label>

      {activa ? (
        <div className="tile grid gap-[var(--space-md)]">
          <div className="field">
            <label className="field__label" htmlFor="pollQuestion">
              Pregunta (opcional)
            </label>
            <input
              id="pollQuestion"
              name="pollQuestion"
              className="input"
              defaultValue={encuesta?.question ?? ""}
              maxLength={MAX_PREGUNTA}
              disabled={disabled}
            />
          </div>

          <div className="field">
            <span className="field__label">Opciones</span>
            <p className="field__help">
              De {MIN_OPCIONES} a {MAX_OPCIONES}.
              {hayVotos
                ? ` Ya tiene ${encuesta?.votos} voto(s): las opciones que existen no se pueden cambiar ni quitar, pero puedes añadir otras.`
                : ""}
            </p>

            <ul className="grid gap-[var(--space-xs)]">
              {filas.map((fila, indice) => {
                const bloqueada = hayVotos && fila.id !== "";
                return (
                  <li key={fila.clave} className="flex items-center gap-[var(--space-xs)]">
                    <input type="hidden" name="pollOptionId" value={fila.id} />
                    <input
                      name="pollOptionLabel"
                      className="input"
                      aria-label={`Opción ${indice + 1}`}
                      value={fila.label}
                      maxLength={MAX_ETIQUETA}
                      readOnly={bloqueada}
                      disabled={disabled}
                      onChange={(evento) =>
                        setFilas((previas) =>
                          previas.map((otra) =>
                            otra.clave === fila.clave
                              ? { ...otra, label: evento.target.value }
                              : otra,
                          ),
                        )
                      }
                    />
                    <Boton
                      type="button"
                      variante="ghost"
                      aria-label={`Quitar la opción ${indice + 1}`}
                      disabled={disabled || bloqueada || filas.length <= MIN_OPCIONES}
                      onClick={() =>
                        setFilas((previas) => previas.filter((otra) => otra.clave !== fila.clave))
                      }
                    >
                      <X size={15} aria-hidden />
                    </Boton>
                  </li>
                );
              })}
            </ul>

            <div>
              <Boton
                type="button"
                disabled={disabled || filas.length >= MAX_OPCIONES}
                onClick={() =>
                  setFilas((previas) => [...previas, { clave: claveNueva(), id: "", label: "" }])
                }
              >
                <Plus size={15} aria-hidden />
                Añadir opción
              </Boton>
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="pollClosesAt">
              Cierre (opcional)
            </label>
            <p className="field__help">
              Pasada esta fecha ya no se puede votar y solo se ven los resultados. Sin fecha, queda
              abierta mientras la noticia esté publicada.
            </p>
            <input
              id="pollClosesAt"
              name="pollClosesAt"
              type="datetime-local"
              className="input"
              defaultValue={aValorLocal(encuesta?.closesAt ?? null)}
              disabled={disabled}
              // El servidor y el navegador no tienen por qué compartir zona horaria.
              suppressHydrationWarning
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Montarlo en `editor-noticia.tsx`**

Importar:

```tsx
import { EditorEncuesta, type EncuestaGuardada } from "@/components/panel/editor-encuesta";
```

En el tipo `Noticia`, añadir tras `notificarPrivado: boolean;`:

```ts
  encuesta: EncuestaGuardada | null;
```

En `onSubmit`, justo después de `const datos = new FormData(evento.currentTarget);`, convertir la fecha (el `datetime-local` no lleva zona horaria):

```ts
    const cierre = String(datos.get("pollClosesAt") ?? "");
    if (cierre) {
      const fecha = new Date(cierre);
      if (Number.isNaN(fecha.getTime())) {
        setError("La fecha de cierre de la encuesta no es válida.");
        return;
      }
      datos.set("pollClosesAt", fecha.toISOString());
    }
```

Y en el JSX, justo **antes** del `<div className="field">` del canal de Discord (el que contiene `htmlFor="categoriaDiscord"`), añadir:

```tsx
      <EditorEncuesta encuesta={noticia?.encuesta ?? null} disabled={guardando} />
```

- [ ] **Step 3: Cargar la encuesta en la página de edición**

En `app/(panel)/panel/noticias/[id]/page.tsx`, dentro del `select` de `db.post.findUnique`, tras `notificarPrivado: true,`:

```ts
        poll: {
          select: {
            question: true,
            closesAt: true,
            options: { orderBy: { position: "asc" }, select: { id: true, label: true } },
            _count: { select: { votes: true } },
          },
        },
```

y cambiar el render a:

```tsx
      <EditorNoticia
        noticia={{
          ...noticia,
          encuesta: noticia.poll
            ? {
                question: noticia.poll.question,
                closesAt: noticia.poll.closesAt?.toISOString() ?? null,
                options: noticia.poll.options,
                votos: noticia.poll._count.votes,
              }
            : null,
        }}
        canales={canales}
        roles={roles}
      />
```

(`poll` sobra en el objeto que se pasa pero TypeScript no se queja por propiedades extra al pasar una variable esparcida; si lo hace, quitarla con `const { poll, ...resto } = noticia;`.)

- [ ] **Step 4: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sin errores.

Comprobación manual (`pnpm dev`, ADMIN):
1. `/panel/noticias/nueva`: marcar "Añadir una encuesta", dejar una opción en blanco → al guardar sale "Las opciones no pueden estar vacías.".
2. Dos opciones válidas y cierre en el pasado → "La fecha de cierre de la encuesta ya ha pasado.".
3. Dos opciones válidas, sin cierre → guarda y redirige. Reabrir la noticia: la encuesta aparece con sus opciones.
4. Quitar y volver a poner la marca sin guardar no pierde lo escrito (las filas viven en el estado).

---

### Task 6: Votar y apoyar (consulta y acciones)

**Files:**
- Modify: `lib/consultas.ts` (`noticiaPorSlug`, `NoticiaCompleta`)
- Create: `lib/interaccion.ts`
- Create: `lib/actions/interaccion.ts`

**Interfaces:**
- Consumes: `puedeVotar`, `encuestaAbierta` (`lib/encuesta.ts`); `requireUser`; `consumir` (`lib/rate-limit`).
- Produces:
  - `NoticiaCompleta.id: string`.
  - `lib/interaccion.ts`: `estadoInteraccion(postId: string, userId: string | null): Promise<EstadoInteraccion>`; tipos `EstadoEncuesta = { id: string; question: string | null; closesAt: string | null; abierta: boolean; opciones: { id: string; label: string; votos: number }[]; miVoto: string | null }` y `EstadoInteraccion = { encuesta: EstadoEncuesta | null; apoyos: number; apoyado: boolean }`.
  - `lib/actions/interaccion.ts`: `votarEncuesta(pollId: string, optionId: string | null): Promise<ResultadoInteraccion>`, `alternarApoyo(postId: string): Promise<ResultadoInteraccion>`, con `ResultadoInteraccion = { ok: boolean; mensaje?: string }` (tipo local, no exportado: un módulo `"use server"` solo exporta funciones).

- [ ] **Step 1: `noticiaPorSlug` devuelve el `id`**

En `lib/consultas.ts`:

- En el tipo `NoticiaCompleta`, añadir como primera propiedad: `id: string;`
- En el `select` de `noticiaPorSlug`, añadir `id: true,` como primera línea.
- En el objeto que devuelve, añadir `id: noticia.id,` como primera línea.
- Cambiar la clave de caché `["noticia"]` por `["noticia-v2"]`. Importante: las entradas guardadas antes de este cambio no traen `id` y se servirían hasta una hora con `id` indefinido.

- [ ] **Step 2: Crear `lib/interaccion.ts`**

```ts
import "server-only";
import { db } from "@/lib/db";
import { encuestaAbierta } from "@/lib/encuesta";

/**
 * Lo que cambia con cada visita —votos, voto propio, apoyos—. Va aparte de
 * `noticiaPorSlug` y sin caché: cachearlo serviría a todos el voto del primero
 * que llegó y los contadores tardarían en moverse.
 */

export type EstadoEncuesta = {
  id: string;
  question: string | null;
  closesAt: string | null;
  abierta: boolean;
  opciones: { id: string; label: string; votos: number }[];
  /** Id de la opción que votó quien mira, si votó. */
  miVoto: string | null;
};

export type EstadoInteraccion = {
  encuesta: EstadoEncuesta | null;
  apoyos: number;
  apoyado: boolean;
};

export async function estadoInteraccion(
  postId: string,
  userId: string | null,
): Promise<EstadoInteraccion> {
  const [poll, apoyos, apoyo] = await Promise.all([
    db.postPoll.findUnique({
      where: { postId },
      select: {
        id: true,
        question: true,
        closesAt: true,
        options: {
          orderBy: { position: "asc" },
          select: { id: true, label: true, _count: { select: { votes: true } } },
        },
      },
    }),
    db.postSupport.count({ where: { postId } }),
    userId
      ? db.postSupport.findUnique({
          where: { postId_userId: { postId, userId } },
          select: { id: true },
        })
      : null,
  ]);

  let encuesta: EstadoEncuesta | null = null;
  if (poll) {
    const voto = userId
      ? await db.pollVote.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId } },
          select: { optionId: true },
        })
      : null;

    encuesta = {
      id: poll.id,
      question: poll.question,
      closesAt: poll.closesAt?.toISOString() ?? null,
      abierta: encuestaAbierta(poll),
      opciones: poll.options.map((opcion) => ({
        id: opcion.id,
        label: opcion.label,
        votos: opcion._count.votes,
      })),
      miVoto: voto?.optionId ?? null,
    };
  }

  return { encuesta, apoyos, apoyado: apoyo !== null };
}
```

- [ ] **Step 3: Crear `lib/actions/interaccion.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/guards";
import { puedeVotar } from "@/lib/encuesta";
import { consumir } from "@/lib/rate-limit";

type ResultadoInteraccion = { ok: boolean; mensaje?: string };

const UNA_HORA = 60 * 60 * 1000;

async function usuarioActual(): Promise<SessionUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/**
 * Vota, cambia el voto o lo retira (`optionId` nulo). Todo se comprueba aquí,
 * no en la interfaz: una pestaña abierta de antes puede estar votando en una
 * encuesta que ya se cerró.
 */
export async function votarEncuesta(
  pollId: string,
  optionId: string | null,
): Promise<ResultadoInteraccion> {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false, mensaje: "Necesitas iniciar sesión con Discord." };

  const limite = consumir(`voto:${usuario.id}`, 30, UNA_HORA);
  if (!limite.permitido) return { ok: false, mensaje: "Demasiados cambios seguidos. Espera un poco." };

  const encuesta = await db.postPoll.findUnique({
    where: { id: pollId },
    select: {
      closesAt: true,
      post: { select: { published: true, slug: true } },
      options: { select: { id: true } },
    },
  });
  if (!encuesta) return { ok: false, mensaje: "Esa encuesta ya no existe." };

  const permiso = puedeVotar(encuesta.post, encuesta);
  if (!permiso.ok) return permiso;

  if (optionId === null) {
    await db.pollVote.deleteMany({ where: { pollId, userId: usuario.id } });
  } else {
    // Una opción de otra encuesta no vale aunque exista.
    if (!encuesta.options.some((opcion) => opcion.id === optionId)) {
      return { ok: false, mensaje: "Esa opción no existe." };
    }

    await db.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: usuario.id } },
      create: { pollId, optionId, userId: usuario.id },
      update: { optionId },
    });
  }

  revalidatePath(`/noticias/${encuesta.post.slug}`);
  return { ok: true };
}

/** Pone o quita el apoyo de quien pulsa. */
export async function alternarApoyo(postId: string): Promise<ResultadoInteraccion> {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false, mensaje: "Necesitas iniciar sesión con Discord." };

  const limite = consumir(`apoyo:${usuario.id}`, 60, UNA_HORA);
  if (!limite.permitido) return { ok: false, mensaje: "Demasiados cambios seguidos. Espera un poco." };

  const noticia = await db.post.findFirst({
    where: { id: postId, published: true },
    select: { slug: true },
  });
  if (!noticia) return { ok: false, mensaje: "Esa noticia no está disponible." };

  const quitados = await db.postSupport.deleteMany({ where: { postId, userId: usuario.id } });
  if (quitados.count === 0) {
    try {
      await db.postSupport.create({ data: { postId, userId: usuario.id } });
    } catch {
      // Dos clics a la vez: el otro ya lo creó. El resultado es el mismo.
    }
  }

  revalidatePath(`/noticias/${noticia.slug}`);
  return { ok: true };
}
```

- [ ] **Step 4: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sin errores.

---

### Task 7: Encuesta y apoyo en la noticia pública

**Files:**
- Create: `components/noticias/encuesta.tsx`
- Create: `components/noticias/boton-apoyo.tsx`
- Modify: `app/globals.css` (añadir al final)
- Modify: `app/(public)/noticias/[slug]/page.tsx`

**Interfaces:**
- Consumes: `EstadoEncuesta` (`lib/interaccion`), `porcentaje` (`lib/encuesta`), `votarEncuesta` y `alternarApoyo` (`lib/actions/interaccion`), `currentUser` (`lib/guards`).
- Produces: `Encuesta({ encuesta, hrefEntrar, logueado })`, `BotonApoyo({ postId, apoyos, apoyado, hrefEntrar, logueado })`.

- [ ] **Step 1: Crear `components/noticias/encuesta.tsx`**

```tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { votarEncuesta } from "@/lib/actions/interaccion";
import { porcentaje } from "@/lib/encuesta";
import type { EstadoEncuesta } from "@/lib/interaccion";
import { formatearFechaHora } from "@/lib/utils";

/**
 * Los resultados se ven siempre. Sin sesión las opciones no se pueden pulsar y
 * se invita a entrar; con sesión se vota, se cambia o se retira el voto con el
 * mismo clic. El servidor decide si se acepta: `abierta` solo pinta.
 */
export function Encuesta({
  encuesta,
  logueado,
  hrefEntrar,
}: {
  encuesta: EstadoEncuesta;
  logueado: boolean;
  hrefEntrar: string;
}) {
  const [voto, setVoto] = useOptimistic(encuesta.miVoto);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  // Los votos que llegan ya incluyen el propio: se descuenta y se vuelve a
  // sumar según lo que esté marcado ahora (lo optimista o lo confirmado).
  const votosDe = (id: string, votos: number) =>
    votos - (encuesta.miVoto === id ? 1 : 0) + (voto === id ? 1 : 0);
  const total = encuesta.opciones.reduce((suma, opcion) => suma + votosDe(opcion.id, opcion.votos), 0);

  const puedeVotar = logueado && encuesta.abierta;

  function votar(id: string) {
    const nuevo = voto === id ? null : id;
    setError(null);

    empezar(async () => {
      setVoto(nuevo);
      const resultado = await votarEncuesta(encuesta.id, nuevo);
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo votar.");
    });
  }

  return (
    <section className="encuesta" aria-label="Encuesta">
      {encuesta.question ? <h2 className="display text-(length:--text-md)">{encuesta.question}</h2> : null}

      <ul className="grid gap-[var(--space-xs)]">
        {encuesta.opciones.map((opcion) => {
          const votos = votosDe(opcion.id, opcion.votos);
          const pct = porcentaje(votos, total);

          return (
            <li key={opcion.id}>
              <button
                type="button"
                className="encuesta__opcion"
                aria-pressed={voto === opcion.id}
                disabled={!puedeVotar}
                onClick={() => votar(opcion.id)}
                style={{ "--porcentaje": `${pct}%` } as React.CSSProperties}
              >
                <span className="encuesta__barra" aria-hidden />
                <span>{opcion.label}</span>
                <span className="meta">
                  {pct}% · {votos}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="meta">
        {total} voto(s)
        {encuesta.closesAt
          ? encuesta.abierta
            ? ` · Cierra el ${formatearFechaHora(encuesta.closesAt)}`
            : " · Cerrada"
          : ""}
        {!logueado && encuesta.abierta ? (
          <>
            {" · "}
            <Link href={hrefEntrar} className="underline hover:text-[var(--color-ink)]">
              Inicia sesión para votar
            </Link>
          </>
        ) : null}
      </p>

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Crear `components/noticias/boton-apoyo.tsx`**

```tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { alternarApoyo } from "@/lib/actions/interaccion";
import { Boton, EnlaceBoton } from "@/components/ui/button";

/** Siempre visible. Sin sesión lleva a entrar; con sesión pone o quita el apoyo. */
export function BotonApoyo({
  postId,
  apoyos,
  apoyado,
  logueado,
  hrefEntrar,
}: {
  postId: string;
  apoyos: number;
  apoyado: boolean;
  logueado: boolean;
  hrefEntrar: string;
}) {
  const [activo, setActivo] = useOptimistic(apoyado);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  // El contador que llega ya cuenta el apoyo propio, si lo hay.
  const cuenta = apoyos - (apoyado ? 1 : 0) + (activo ? 1 : 0);

  function alternar() {
    setError(null);
    empezar(async () => {
      setActivo(!activo);
      const resultado = await alternarApoyo(postId);
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo apoyar.");
    });
  }

  const contenido = (
    <>
      <Heart size={15} aria-hidden fill={activo ? "currentColor" : "none"} />
      Apoyar · {cuenta}
    </>
  );

  return (
    <div className="grid justify-items-start gap-[var(--space-2xs)]">
      {logueado ? (
        <Boton type="button" className="btn--pill" aria-pressed={activo} onClick={alternar}>
          {contenido}
        </Boton>
      ) : (
        <EnlaceBoton href={hrefEntrar} className="btn--pill" title="Inicia sesión para apoyar">
          {contenido}
        </EnlaceBoton>
      )}
      {!logueado ? (
        <p className="meta">
          <Link href={hrefEntrar} className="underline hover:text-[var(--color-ink)]">
            Inicia sesión
          </Link>{" "}
          para apoyar esta noticia.
        </p>
      ) : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Estilos**

Añadir al final de `app/globals.css`:

```css
/* ---------- Encuesta de las noticias ---------- */

.encuesta {
  display: grid;
  gap: var(--space-sm);
}

.encuesta__opcion {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: var(--rule-hair) solid var(--color-rule-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
  text-align: left;
  overflow: hidden;
  transition: border-color var(--dur-micro) var(--ease-out);
}

.encuesta__opcion:not(:disabled) {
  cursor: pointer;
}

.encuesta__opcion:not(:disabled):hover,
.encuesta__opcion[aria-pressed="true"] {
  border-color: var(--color-ink);
}

/* La barra es el resultado: ocupa el porcentaje de la fila, por detrás del texto. */
.encuesta__barra {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--porcentaje);
  background: var(--color-paper-3);
  transition: width var(--dur-micro) var(--ease-out);
}

.encuesta__opcion > :not(.encuesta__barra) {
  position: relative;
}
```

- [ ] **Step 4: Pintarlo en la página**

En `app/(public)/noticias/[slug]/page.tsx`:

Importaciones nuevas:

```tsx
import { currentUser } from "@/lib/guards";
import { estadoInteraccion } from "@/lib/interaccion";
import { Encuesta } from "@/components/noticias/encuesta";
import { BotonApoyo } from "@/components/noticias/boton-apoyo";
```

Tras `if (!noticia) notFound();` en `NoticiaPage`:

```tsx
  // Votos y apoyos no entran en la caché de la noticia: cambian en cada visita y
  // dependen de quién mira.
  const usuario = await currentUser();
  const interaccion = await estadoInteraccion(noticia.id, usuario?.id ?? null);
  const hrefEntrar = `/entrar?callbackUrl=${encodeURIComponent(`/noticias/${slug}`)}`;
```

Y, tras el `<div className="prose prose--articulo" ... />` del contenido, antes de `</article>`:

```tsx
      <footer className="grid gap-[var(--space-lg)]">
        {interaccion.encuesta ? (
          <Encuesta
            encuesta={interaccion.encuesta}
            logueado={usuario !== null}
            hrefEntrar={hrefEntrar}
          />
        ) : null}

        <BotonApoyo
          postId={noticia.id}
          apoyos={interaccion.apoyos}
          apoyado={interaccion.apoyado}
          logueado={usuario !== null}
          hrefEntrar={hrefEntrar}
        />
      </footer>
```

- [ ] **Step 5: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sin errores.

---

### Task 8: Verificación de extremo a extremo

**Files:** ninguno (solo comprobaciones).

- [ ] **Step 1: Suite completa y build**

Run: `pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build`
Expected: todo verde y el build termina sin errores.

- [ ] **Step 2: Recorrido manual** (`pnpm dev`)

Preparar una noticia de prueba publicada con encuesta de 3 opciones y cierre en un futuro cercano.

1. **Sin sesión**, `/noticias/<slug>`: se ve la encuesta con resultados; las opciones no se pulsan; "Inicia sesión para votar" lleva a `/entrar?callbackUrl=/noticias/<slug>`. El botón "Apoyar" es un enlace a entrar.
2. **Con sesión de usuario normal:** votar marca la opción y sube su contador; pulsar otra mueve el voto; pulsar la propia lo retira. "Apoyar" suma 1 y al pulsar de nuevo quita el apoyo. Recargar conserva ambos.
3. **Cierre:** editar la noticia y poner el cierre en el pasado → la encuesta pasa a "Cerrada", sin interacción.
4. **Votos y edición:** con votos emitidos, abrir el editor → las opciones existentes son de solo lectura y sin botón de quitar útil; se puede añadir una opción; desactivar la encuesta pide confirmar.
5. **Eliminar:** con un ADMIN, eliminar la noticia de prueba → desaparece de `/panel/noticias` y de `/noticias`; su portada ya no está en `public/uploads`; hay una línea nueva en el registro de auditoría. Con un usuario sin rol ADMIN, `/panel/noticias` sigue redirigiendo o rechazando como antes.
6. **Noticia sin encuesta:** solo sale el botón de apoyo.

- [ ] **Step 3: Informar**

Resumir al usuario qué se verificó y qué no (p. ej. si no se pudo probar con un moderador real). No hacer commit: esperar a que lo pida.
