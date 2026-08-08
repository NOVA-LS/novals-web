# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencias ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# El cliente de Prisma se crea al importarlo, así que compilar una página que lo
# use exige una ruta aunque no se consulte nada. La de verdad la pone Compose al
# arrancar; esta se queda en la capa de compilación y no llega a producción.
ENV DATABASE_URL="file:/tmp/compilacion.db"

RUN pnpm prisma generate && pnpm build

# ---- Producción ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Para las copias de seguridad: la orden «.backup» de SQLite saca una copia
# entera aunque haya alguien escribiendo, cosa que copiar el fichero a pelo no
# garantiza (ver deploy/copia.sh).
RUN apk add --no-cache sqlite

# El servidor standalone no incluye node_modules completo, pero Prisma y las
# migraciones sí se necesitan en tiempo de ejecución.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN mkdir -p /app/data /app/public/uploads

EXPOSE 3000
# Prisma se llama por su binario y no por pnpm: al runner no llegan el lockfile
# ni el workspace, así que pnpm se cree que faltan dependencias y trata de
# instalarlas al arrancar, cosa que aquí ni puede ni debe hacer.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]
