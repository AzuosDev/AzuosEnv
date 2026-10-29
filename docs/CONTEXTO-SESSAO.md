# CONTEXTO-SESSAO — Azuos Env
Etapa concluída: 1 · Próxima: 2
## Stack
Node.js LTS, NestJS 12 (ESM-only), MongoDB Atlas, Mongoose 9, JWT access+refresh (rotação), IA Grok (xAI). Front: React + TanStack.
## Decisões
- Multi-tenant por workspaceId; rotas /api/v1/workspaces/:wsId/...
- Refresh token em cookie httpOnly, rotacionado, com detecção de reuso.
- IDs visíveis de tarefa: PREFIXO-n (ex.: AZD-142), contador atômico por workspace.
- NestJS 12 é ESM-only; dist em CommonJS (require(esm) do Node 24). Jest roda com `node --experimental-vm-modules`.
- ValidationPipe, filtro de exceções e ThrottlerGuard (120 req/min) registrados via APP_PIPE/APP_FILTER/APP_GUARD em AppModule; setup HTTP compartilhado em src/app.setup.ts (reusado pelos testes e2e).
- Validação de env com Joi (`unknown(true)`, abortEarly false) em src/config/env.validation.ts.
## Módulos
- health (src/modules/health)
- common: filters/all-exceptions.filter, pagination/cursor (encode/decode base64url + buildCursorPage), pipes/parse-object-id.pipe, schemas/base-schema-options (timestamps, toJSON com id, sem _id/__v)
## Endpoints
- GET /api/v1/health (público) → { status: "ok", db: "up" | "down" }
- Swagger em /api/docs (fora de produção)
## Variáveis de ambiente
NODE_ENV, PORT, MONGODB_URI, CORS_ORIGINS, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL=15m, JWT_REFRESH_TTL=30d, COOKIE_SECURE, COOKIE_DOMAIN (ver backend/.env.example)
## Padrões aplicados
- Prefixo global api/v1, helmet, cookie-parser, CORS com credentials, body limit 1 MB, shutdown hooks.
- Erros: { statusCode, code, message }.
- Testes: `npm test` (unit) e `npm run test:e2e` (supertest + mongodb-memory-server). O mongod sobe uma vez em test/utils/global-setup.ts (env de teste em test-env.ts); `createTestApp()` em test/utils/e2e-app.ts dá app + clearDatabase().
## Pendências
(nenhuma)
