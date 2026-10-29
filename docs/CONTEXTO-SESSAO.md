# CONTEXTO-SESSAO — Azuos Env
Etapa concluída: 2 · Próxima: 3
## Stack
Node.js LTS, NestJS 12 (ESM-only), MongoDB Atlas, Mongoose 9, JWT access+refresh (rotação), IA Grok (xAI). Front: React + TanStack.
Auth: @nestjs/jwt, @nestjs/passport, passport-jwt, argon2 (argon2id).
## Decisões
- Multi-tenant por workspaceId; rotas /api/v1/workspaces/:wsId/...
- Refresh token em cookie httpOnly, rotacionado, com detecção de reuso.
- IDs visíveis de tarefa: PREFIXO-n (ex.: AZD-142), contador atômico por workspace.
- NestJS 12 é ESM-only; dist em CommonJS (require(esm) do Node 24). Jest roda com `node --experimental-vm-modules`.
- ValidationPipe, filtro de exceções, ThrottlerGuard (120 req/min) e JwtAuthGuard registrados via APP_PIPE/APP_FILTER/APP_GUARD em AppModule; setup HTTP compartilhado em src/app.setup.ts (reusado pelos testes e2e).
- Validação de env com Joi (`unknown(true)`, abortEarly false) em src/config/env.validation.ts.
- Refresh token é opaco (48 bytes base64url), guardado só como sha256 em refresh_tokens; rotação dentro da mesma família (familyId uuid). Reuso de token revogado revoga a família e responde 401 REFRESH_TOKEN_REUSED. Sessão = família.
- `app.set('trust proxy', 1)`: o throttler usa o IP real atrás do proxy (e os testes isolam contadores por X-Forwarded-For).
- RefreshTokensModule é separado (src/modules/auth/refresh-tokens.*) para auth e users usarem sem dependência circular.
- Rotas são autenticadas por padrão; libere com @Public(). Usuário da requisição via @CurrentUser() (JwtStrategy recarrega o usuário do banco).
## Módulos
- health (src/modules/health) — público
- auth (src/modules/auth): auth.service/controller, refresh-tokens.service/module, strategies/jwt.strategy, guards/jwt-auth.guard, schemas/refresh-token
- users (src/modules/users): users.service/controller, schemas/user
- common: filters/all-exceptions.filter, pagination/cursor, pipes/parse-object-id.pipe, schemas/base-schema-options, decorators/{public,current-user}, utils/duration (durationToMs)
## Coleções
- users: name, email (único, minúsculo), passwordHash (argon2id, select:false e fora do toJSON), avatarUrl, timezone (America/Fortaleza), locale (pt-BR), theme (dark|light|system, padrão dark), lastLoginAt
- refresh_tokens: userId, familyId, tokenHash (único), expiresAt (índice TTL), revokedAt, replacedById, userAgent, ip
## Endpoints
- GET /api/v1/health (público) → { status: "ok", db: "up" | "down" }
- POST /api/v1/auth/register (público, 5/min/IP) → 201 { user }; senha ≥ 8 com letra e número; e-mail duplicado → 409 EMAIL_IN_USE
- POST /api/v1/auth/login (público, 5/min/IP) → { accessToken, user } + cookie refresh_token (httpOnly, sameSite=lax, secure por env, path /api/v1/auth)
- POST /api/v1/auth/refresh (público, usa o cookie) → { accessToken, user } + cookie rotacionado
- POST /api/v1/auth/logout (público) · POST /api/v1/auth/logout-all → { success: true }
- GET /api/v1/auth/me → usuário autenticado
- GET /api/v1/auth/sessions → [{ id, userAgent, ip, current, createdAt, expiresAt }]
- DELETE /api/v1/auth/sessions/:id → { success: true }; sessão de outro usuário → 404 SESSION_NOT_FOUND
- PATCH /api/v1/users/me (name, avatarUrl, timezone, locale, theme) → usuário atualizado
- PATCH /api/v1/users/me/password (currentPassword, newPassword) → { success: true } e revoga todas as sessões; senha atual errada → 400 INVALID_PASSWORD
- Swagger em /api/docs (fora de produção)
## Variáveis de ambiente
NODE_ENV, PORT, MONGODB_URI, CORS_ORIGINS, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL=15m, JWT_REFRESH_TTL=30d, COOKIE_SECURE, COOKIE_DOMAIN (ver backend/.env.example)
## Padrões aplicados
- Prefixo global api/v1, helmet, cookie-parser, CORS com credentials, body limit 1 MB, shutdown hooks, trust proxy.
- Erros: { statusCode, code, message }. Códigos de auth: UNAUTHORIZED, INVALID_CREDENTIALS, INVALID_REFRESH_TOKEN, REFRESH_TOKEN_REUSED, REFRESH_TOKEN_EXPIRED, EMAIL_IN_USE, INVALID_PASSWORD, SESSION_NOT_FOUND.
- Testes: `npm test` (unit) e `npm run test:e2e` (supertest + mongodb-memory-server). O mongod sobe uma vez em test/utils/global-setup.ts (env de teste em test-env.ts); `createTestApp()` em test/utils/e2e-app.ts dá app + clearDatabase(); helpers de auth (registro, login, cookie, IP por teste) em test/utils/auth-client.ts.
## Pendências
- JWT_REFRESH_SECRET continua sem uso (refresh token é opaco, não JWT).
