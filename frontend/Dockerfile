# syntax=docker/dockerfile:1

# ---------- build: Vite com as devDependencies ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts pwa.config.ts ./
COPY postcss.config.js tailwind.config.ts index.html ./
COPY scripts ./scripts
COPY public ./public
COPY src ./src

# A URL da API entra no bundle: vem como build-arg, não em runtime.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- runtime: nginx servindo os estáticos ----------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
