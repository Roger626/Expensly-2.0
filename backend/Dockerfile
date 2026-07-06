# ETAPA DE CONSTRUCCIÓN
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Añade esto justo antes de prisma generate
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY . .
# 1. Generar cliente (incluye el parche de prisma/fix-generated.js para los
# modelos de prisma-class-validator-generator, que de otro modo usan
# Prisma.Decimal/Prisma.JsonValue, no exportados desde @prisma/client v6)
RUN npm run prisma:generate
# 2. Compilar NestJS
RUN npm run build

# --- LA CLAVE ESTÁ AQUÍ ---
# El generador "prisma-client" (schema.prisma usa output = "../generated/prisma")
# escribe el motor de consulta nativo DIRECTAMENTE en ese output personalizado,
# no en node_modules/.prisma/client (eso solo aplica al generador clásico
# "prisma-client-js"). tsc tampoco copia binarios .node al compilar, así que
# hay que copiarlo a mano desde su ubicación real tras el build.
RUN mkdir -p dist/generated/prisma && \
    cp generated/prisma/libquery_engine-*.so.node dist/generated/prisma/

RUN npm prune --omit=dev

# ETAPA DE EJECUCIÓN
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# schema.prisma + migrations: necesarios en runtime para que
# `prisma migrate deploy` aplique el esquema a la base de datos del
# contenedor antes de arrancar la app (prisma generate NO toca la DB).
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]