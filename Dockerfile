# ---- Base ----
FROM node:lts-slim AS base
RUN apt-get update && apt-get install -y openssl python3 make g++ postgresql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./prisma.config.ts

# ---- Dependencies ----
FROM base AS deps
RUN npm ci --legacy-peer-deps

# ---- Builder ----
FROM deps AS builder
COPY . .
RUN npm run build
RUN cp src/schema.graphql dist/schema.graphql

# ---- Production ----
FROM node:lts-slim AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl postgresql-client && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated/prisma ./generated/prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json /app/package-lock.json ./

EXPOSE 4000

CMD ["npm","start"]
