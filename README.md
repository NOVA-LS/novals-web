# NOVA · Los Santos

Web del servidor : noticias, postulaciones (whitelist, facción,
staff) y panel de staff para revisarlas.

## Stack

- Next.js 16 (App Router) + TypeScript
- SQLite mediante Prisma 7 (`data/nova.db`)
- Auth.js v5 con Discord como único proveedor
- Tailwind 4 sobre un sistema de tokens propio (`tokens.css`)
- Vitest para la lógica de reglas y validación

## Puesta en marcha en local

```bash
pnpm install
cp .env.example .env          # rellena las variables de Discord
pnpm prisma migrate dev
pnpm seed <tu-discord-id>     # crea la config de formularios y tu admin
pnpm dev
```

Para obtener tu ID de Discord: ajustes de usuario → Avanzado → Modo desarrollador,
luego clic derecho sobre tu nombre → «Copiar ID de usuario».

### Aplicación de Discord

En <https://discord.com/developers/applications> crea una aplicación y, en
OAuth2, añade la URL de redirección:

```
<AUTH_URL>/api/auth/callback/discord
```

En local eso es `http://localhost:3000/api/auth/callback/discord`.

El aviso al staff usa un webhook de canal (`DISCORD_WEBHOOK_URL`). Es opcional:
si falta, la web funciona igual y solo se pierde la notificación.

### Avisos por privado

La web escribe un mensaje directo a quien envía una solicitud cuando la
recibimos, cuando pasa a revisión y cuando se resuelve. No hay ningún proceso
aparte: son dos llamadas a la API de Discord con el token del bot.

Para activarlo, en la misma aplicación de Discord:

1. Pestaña **Bot** → **Reset Token** y copia el valor en `DISCORD_BOT_TOKEN`.
2. Pestaña **OAuth2** → URL Generator → scope `bot`, sin permisos extra. Abre la
   URL e **invita al bot al servidor de la comunidad**.

El paso 2 no es opcional: Discord no permite escribir un mensaje directo a
alguien con quien el bot no comparte servidor.

Y hay una condición del lado del jugador que no controlamos: en su cliente, el
servidor tiene que tener activados los mensajes directos (clic derecho sobre el
servidor → Privacidad → Mensajes directos). Si los tiene apagados, Discord
responde 50278 «no mutual guilds» aunque el bot esté dentro del servidor. Pasa a
menudo. En ese caso salta un aviso al canal de staff con la mención del jugador
para que se lo digan a mano.

Sin `DISCORD_BOT_TOKEN` no se manda ningún privado y la web funciona igual.

### Bot en línea

Con el mismo token, la web abre una conexión de gateway al arrancar
(`instrumentation.ts` → `lib/discord-presence.ts`) para que el bot no aparezca
desconectado en la lista de miembros. No pide ningún intent, no escucha nada y
se reconecta sola con espera creciente.

Es solo estética: si esa conexión se cae, los avisos siguen saliendo porque van
por la API REST. Levanta **una sola instancia** de la web; varias abrirían varias
conexiones con el mismo bot.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción (salida standalone) |
| `pnpm test` | Tests de Vitest |
| `pnpm db:migrate` | Crea y aplica una migración |
| `pnpm seed [discordId]` | Configura los formularios y, opcionalmente, un admin |

## Despliegue con Docker

```bash
cp .env.example .env          # rellena AUTH_SECRET, Discord y AUTH_URL público
docker compose up -d --build
```

- `AUTH_SECRET`: genéralo con `openssl rand -base64 33`.
- `AUTH_URL`: la URL pública real (por ejemplo `https://nova.example.com`).
  Detrás de un proxy inverso hace falta pasar `X-Forwarded-Proto` y `Host`.

Dos volúmenes guardan lo que no debe perderse al reconstruir la imagen:

- `nova-data` → `/app/data` (la base de datos)
- `nova-uploads` → `/app/public/uploads` (portadas de noticias y fotos de la galería)

Las migraciones se aplican solas al arrancar el contenedor.

Para crear el primer admin en producción:

```bash
docker compose exec web pnpm seed <tu-discord-id>
```

### Copia de seguridad

```bash
docker compose exec web sh -c 'sqlite3 /app/data/nova.db ".backup /app/data/backup.db"'
docker compose cp web:/app/data/backup.db ./backup-$(date +%F).db
```

Copia también el volumen `nova-uploads` si te importan las imágenes.

## Estructura

```
app/(public)/     Web pública: home, noticias, foro, formularios, perfil
app/(panel)/      Panel de staff, protegido por middleware y por rol en la BD
lib/forms/        Una definición por formulario: preguntas + validación
lib/foro/         Categorías y reglas de permisos del foro, puras y probadas
lib/actions/      Server Actions (envío, resolución, noticias, galería, ajustes)
lib/uploads.ts    Guardado y borrado de imágenes en public/uploads
lib/guards.ts     currentUser / requireUser: el rol se lee de la BD, no del JWT
tokens.css        Sistema de diseño: color, tipografía, espacio, movimiento
```

### Galería

`/panel/galeria` sube fotos, les pone pie y las ordena. Las cinco primeras se
van fundiendo de fondo en la portada. Al borrar una foto se borra también el
archivo del disco.

Sin fotos subidas la portada cae en su versión tipográfica, sin carrusel.

### Perfil

`/perfil` reúne los datos de la cuenta y el estado de todas sus solicitudes.
`/mis-solicitudes` sigue existiendo y redirige ahí: los privados de Discord ya
enviados apuntan a esa ruta y romperlos dejaría enlaces muertos.

### Foro

`/foro` con categorías definidas en `lib/foro/categorias.ts` (añadir una es
editar ese archivo). Hilos con respuestas en Markdown saneado, editar y borrar lo
propio, y moderación del staff: fijar, cerrar y borrar.

**Leer es público; escribir pide la whitelist aceptada.** El staff siempre puede,
whitelist o no, y también responder en hilos cerrados. Las reglas viven puras en
`lib/foro/reglas.ts` con sus pruebas: la interfaz esconde los botones, pero quien
decide de verdad es la Server Action.

### Insignias

`/panel/insignias`, solo para administración. Se crean con nombre, descripción e
icono, y se conceden a mano. Salen junto al nombre en el foro y en el perfil.

Los iconos son un mapa cerrado en `components/ui/insignia.tsx`: aceptar cualquier
nombre de lucide obligaría a cargar la librería entera en el navegador.

### Notas internas

Cada solicitud enseña las notas que el staff ha ido dejando sobre esa persona,
con autor y fecha. Nunca se le muestran a ella, ni en su perfil ni por privado.
Cada revisor borra las suyas; un admin, cualquiera.

### Añadir un formulario nuevo

1. Crea `lib/forms/<tipo>.ts` con sus preguntas.
2. Regístralo en `lib/forms/index.ts`.
3. Ejecuta `pnpm seed` para crear su configuración.

No hay que tocar el panel ni la base de datos: la bandeja, el detalle y los
ajustes lo recogen solos.

### Cambiar preguntas de un formulario existente

Sube el `version` de su definición. Las solicitudes antiguas guardan la versión
con la que se enviaron y el panel sigue mostrando sus respuestas, marcando las
preguntas que ya no existen.

## Roles

| Rol | Puede |
| --- | --- |
| `USER` | Enviar solicitudes y ver las suyas |
| `REVIEWER` | Además, la bandeja de solicitudes y las noticias |
| `ADMIN` | Además, abrir/cerrar formularios, cooldowns y roles |

Los roles se asignan desde `/panel/ajustes`. El primero se crea con `pnpm seed`.
