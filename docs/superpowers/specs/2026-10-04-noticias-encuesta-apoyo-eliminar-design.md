# Noticias: eliminar, encuesta opcional y apoyo

Fecha: 2026-10-04

## Objetivo

Tres mejoras sobre las noticias:

1. Que solo los usuarios con rol `ADMIN` puedan eliminar una noticia desde el panel.
2. Que el creador de noticias permita añadir una encuesta opcional, que se muestra al final del anuncio. Cualquiera la ve; solo los usuarios con sesión votan.
3. Un botón de apoyo al final de cada noticia. Hace falta sesión para pulsarlo.

## Decisiones acordadas

| Tema | Decisión |
| --- | --- |
| Voto | Una opción por usuario; se puede cambiar o retirar mientras la encuesta esté abierta. |
| Cierre | Fecha de cierre opcional. Pasada la fecha, solo se ven resultados. |
| Quién vota y apoya | Cualquier usuario con sesión, tenga o no whitelist. |
| Edición con votos | Las opciones existentes quedan bloqueadas. Se pueden añadir opciones, cambiar la fecha de cierre o desactivar la encuesta (borra los votos, con confirmación). |
| Resultados | Visibles siempre, también sin sesión. |
| Apoyo | "Me gusta" con contador, un apoyo por usuario, se puede quitar. |
| "Cada publicación" | Cada noticia. El foro queda fuera. |

## Fuera de alcance

- Anuncio de la encuesta en Discord.
- Apoyos en el foro.
- Notificaciones a quien apoya o vota.
- Encuestas de varias opciones.

## 1. Modelo de datos

Una migración Prisma nueva. Todas las relaciones con `onDelete: Cascade` desde `Post`, de modo que borrar una noticia arrastra encuesta, opciones, votos y apoyos.

```prisma
model PostPoll {
  id        String       @id @default(cuid())
  postId    String       @unique
  post      Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
  /// Pregunta opcional; sin ella solo se muestran las opciones.
  question  String?
  /// Pasada esta fecha no se puede votar. Sin fecha, abierta mientras la noticia esté publicada.
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

`Post` gana `poll PostPoll?` y `supports PostSupport[]`; `User` gana `pollVotes` y `supports`. La unicidad `[pollId, userId]` garantiza un voto por usuario a nivel de base de datos.

## 2. Reglas puras: `lib/encuesta.ts`

Módulo sin dependencia de `lib/db`, probable sin `DATABASE_URL` (igual que `lib/noticias.ts`).

- `esquemaEncuesta` (zod):
  - `question`: opcional, `trim`, máx. 120, cadena vacía → `undefined`.
  - `options`: de 2 a 6 elementos, cada uno `trim`, 1–80 caracteres, sin duplicados (sin distinguir mayúsculas).
  - `closesAt`: opcional, fecha válida y futura al crear.
- `encuestaAbierta(encuesta, ahora)`: `true` si no hay `closesAt` o `closesAt > ahora`.
- `cambiosPermitidos(actuales, nuevas, hayVotos)`: sin votos, cualquier cambio. Con votos, las opciones existentes (por `id`) no pueden cambiar de texto ni eliminarse; solo se pueden añadir opciones. Devuelve `{ ok: true }` o `{ ok: false, mensaje }`.

`esquemaNoticia` (`lib/noticias.ts`) incorpora `encuesta` como bloque opcional.

## 3. Eliminar noticia (solo ADMIN)

**Acción:** `eliminarNoticia(id)` en `lib/actions/posts.ts`.

- `requireUser("ADMIN")`. `ADMIN` es el máximo escalón, así que excluye a moderador, soporte e iniciador.
- Lee `slug`, `title` y `coverImage` antes de borrar.
- `db.post.delete` (el cascade elimina encuesta, votos y apoyos).
- Borra la portada del disco con `borrarImagen` (`lib/uploads.ts`). Un fallo al borrar el fichero no revierte el borrado ni se propaga al usuario.
- Registra en auditoría con `apuntar` (`ACCIONES.CONTENIDO`, objetivo = título).
- Invalida caché: `updateTag(ETIQUETA.noticias)` y `revalidatePath` de `/`, `/noticias`, `/noticias/{slug}` y `/panel/noticias`.

**UI:** en cada fila de `/panel/noticias`, botón "Eliminar" junto a "Ver" y "Despublicar", visible solo si el rol del usuario es `ADMIN`. Abre un diálogo de confirmación (`@radix-ui/react-dialog`) con el título de la noticia y aviso de que es definitivo y borra también encuesta y apoyos. Componente cliente nuevo: `components/panel/eliminar-noticia.tsx`.

## 4. Creador de noticias

`components/panel/editor-noticia.tsx`:

- Interruptor "Añadir encuesta". Al activarlo aparecen: pregunta opcional, lista de opciones (mínimo 2, máximo 6, con añadir y quitar fila) y fecha de cierre opcional.
- La encuesta viaja en el `FormData` (`pollEnabled`, `pollQuestion`, `pollOption` repetido con su `id` si existe, `pollClosesAt`).
- Al editar una noticia con encuesta y votos, las opciones existentes salen en solo lectura con aviso ("Ya tiene votos: no se pueden cambiar ni quitar"). El interruptor sigue disponible; al desactivarlo se pide confirmación porque se pierden los votos.
- El editor recibe la encuesta actual y el número de votos por la página `app/(panel)/panel/noticias/[id]/page.tsx`.

`guardarNoticia`:

- Valida el bloque con `esquemaEncuesta`.
- Con la encuesta desactivada, borra la encuesta existente (cascade).
- Con la encuesta activada: crea o actualiza `PostPoll`; aplica `cambiosPermitidos` en servidor; crea, actualiza o elimina opciones en una transacción junto con la noticia. La validación del servidor es la que cuenta; la del cliente es solo comodidad.

## 5. Vista pública

`app/(public)/noticias/[slug]/page.tsx`. Al final, tras el cuerpo, en este orden: encuesta (si existe) y botón de apoyo.

**Caché.** `noticiaPorSlug` sigue cacheada. Los votos y apoyos cambian continuamente y dependen del usuario, así que no entran en esa caché. Una consulta nueva sin caché (`estadoInteraccion(postId, userId | null)` en `lib/consultas.ts`) devuelve:

- Por opción: id, texto, posición y número de votos.
- Voto del usuario actual (id de opción o `null`).
- Total de apoyos y si el usuario actual ha apoyado.
- Datos de la encuesta: pregunta y `closesAt`.

La página lee la sesión con `currentUser()` y pasa el resultado a los componentes cliente. Ya es `force-dynamic`.

**Encuesta** (`components/noticias/encuesta.tsx`, cliente):

- Muestra pregunta, opciones y barras con porcentaje y número de votos. Los resultados se ven siempre.
- Sin sesión: opciones deshabilitadas y enlace "Inicia sesión para votar".
- Con sesión y encuesta abierta: pulsar una opción vota; pulsar la propia la retira; pulsar otra cambia el voto. Actualización optimista y vuelta atrás si la acción falla.
- Cerrada (`closesAt` pasada): sin interacción y etiqueta "Cerrada".

**Apoyo** (`components/noticias/boton-apoyo.tsx`, cliente):

- Icono `Heart` con contador, siempre visible.
- Sin sesión: lleva al inicio de sesión, con aviso accesible.
- Con sesión: toggle con actualización optimista.

**Acciones** (`lib/actions/interaccion.ts`, nuevo):

- `votarEncuesta(optionId | null)`: `requireUser()`. Resuelve la encuesta desde la opción. Comprueba que la noticia esté publicada y la encuesta abierta (`encuestaAbierta`). `upsert` sobre `[pollId, userId]`; `null` borra el voto. Limitada con `consumir()` de `lib/rate-limit`.
- `alternarApoyo(postId)`: `requireUser()`. Comprueba que la noticia esté publicada. Si existe la fila la borra, si no la crea. Limitada con `consumir()`.
- Ambas devuelven `{ ok, mensaje? }` y llaman a `revalidatePath` de la noticia.

Sin sesión, `requireUser()` lanza `NO_AUTENTICADO`; la UI no llega a invocarlas, y si se invocan a mano, el servidor las rechaza.

## 6. Errores y casos límite

- Encuesta cerrada o noticia despublicada: las acciones devuelven `{ ok: false }` con mensaje; la UI lo muestra y recarga el estado.
- Opción que no pertenece a la encuesta: se rechaza.
- Dos pestañas votando a la vez: la unicidad `[pollId, userId]` más `upsert` evita duplicados.
- Noticia sin encuesta: la sección no se renderiza; el apoyo sí.
- Despublicar una noticia conserva encuesta, votos y apoyos.

## 7. Pruebas (vitest)

- `tests/encuesta.test.ts`: `esquemaEncuesta` (límites de opciones, duplicados, longitudes, fecha), `encuestaAbierta` (sin cierre, futura, pasada) y `cambiosPermitidos` (con y sin votos, añadir, editar, eliminar).
- `tests/posts-esquema.test.ts`: `esquemaNoticia` con y sin bloque de encuesta.
- Las acciones de servidor y los componentes no se prueban contra base de datos, como el resto del repo. Se verifica a mano: migración, flujo de votación con y sin sesión, borrado como ADMIN y como otro rol.

## 8. Archivos

Nuevos: `lib/encuesta.ts`, `lib/actions/interaccion.ts`, `components/noticias/encuesta.tsx`, `components/noticias/boton-apoyo.tsx`, `components/panel/eliminar-noticia.tsx`, una migración en `prisma/migrations/`, `tests/encuesta.test.ts`.

Modificados: `prisma/schema.prisma`, `lib/noticias.ts`, `lib/actions/posts.ts`, `lib/consultas.ts`, `components/panel/editor-noticia.tsx`, `app/(panel)/panel/noticias/page.tsx`, `app/(panel)/panel/noticias/[id]/page.tsx`, `app/(public)/noticias/[slug]/page.tsx`, `tests/posts-esquema.test.ts`.
