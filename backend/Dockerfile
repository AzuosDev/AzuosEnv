# syntax=docker/dockerfile:1

# ---------- deps: só as dependências de produção ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# argon2 compila quando não há binário pronto para a plataforma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- build: compila o TypeScript com as devDependencies ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- runtime: node_modules de produção + dist ----------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN mkdir -p /app/storage/uploads && chown -R node:node /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000
VOLUME ["/app/storage/uploads"]

# Sem curl na imagem: o próprio Node consulta o health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT||3000}/api/v1/health`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/main"]
