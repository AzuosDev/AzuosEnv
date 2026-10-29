# CONTEXTO-SESSAO — Azuos Env
Etapa concluída: 3 · Próxima: 4
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
- WorkspaceGuard (por rota/controller, roda depois do JwtAuthGuard) resolve :wsId, exige membro ativo (senão 404 WORKSPACE_NOT_FOUND) e anexa req.workspace/req.membership (@CurrentWorkspace()/@CurrentMembership()). O mesmo guard aplica @Roles('<papel mínimo>') pela hierarquia owner > admin > member > limited > guest (403 FORBIDDEN_ROLE).
- Papel owner só muda por transfer-ownership (o antigo owner vira admin). Convite para e-mail com conta já existente cria member status=invited; sem conta, só o invite até ser aceito.
- Convite: token opaco (32 bytes base64url) guardado só como sha256; validade 7 dias; POST de criação devolve token/acceptUrl para o admin copiar o link.
- MailService (abstract em src/modules/mail) com LogMailService (só log). SMTP na Etapa 8.
- Filtros Mongoose são montados como literais (ternário) porque Mongoose 9 não exporta FilterQuery.
- Equipes usam exclusão definitiva (schema sem deletedAt); workspace usa soft delete.
## Módulos
- health (src/modules/health) — público
- auth (src/modules/auth): auth.service/controller, refresh-tokens.service/module, strategies/jwt.strategy, guards/jwt-auth.guard, schemas/refresh-token
- users (src/modules/users): users.service/controller, schemas/user
- mail (src/modules/mail): mail.service (abstract MailService), log-mail.service, mail.module
- workspaces (src/modules/workspaces): workspaces/members/invites/teams .service+.controller, guards/workspace.guard, decorators/{roles,workspace-context}, workspace-roles.ts, workspace-context.ts, schemas/{workspace,workspace-member,invite,team}
- common: filters/all-exceptions.filter, pagination/{cursor,pagination-query.dto}, pipes/parse-object-id.pipe, schemas/base-schema-options, decorators/{public,current-user}, utils/{duration,hash (sha256Hex),slug (slugify)}
## Coleções
- users: name, email (único, minúsculo), passwordHash (argon2id, select:false e fora do toJSON), avatarUrl, timezone (America/Fortaleza), locale (pt-BR), theme (dark|light|system, padrão dark), lastLoginAt
- refresh_tokens: userId, familyId, tokenHash (único), expiresAt (índice TTL), revokedAt, replacedById, userAgent, ip
- workspaces: name, slug (único, gerado do nome), logoUrl, color (#2563EB), taskPrefix (3 letras do nome), ownerId, timezone (America/Fortaleza), settings.clickApps (priority, tags, timeTracking, estimates, sprints, customFields, multipleLists, customIds, ai — todos true), deletedAt
- workspace_members: workspaceId, userId, role (owner|admin|member|limited|guest), status (active|invited|deactivated), capacityPerDay (8), invitedBy, joinedAt; índice único (workspaceId, userId)
- invites: workspaceId, email, role (sem owner), tokenHash (único, fora do toJSON), expiresAt (7 dias), acceptedAt, invitedBy
- teams: workspaceId, name, memberIds (só membros ativos)
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
- POST /api/v1/workspaces (name, slug?, logoUrl?, color?, taskPrefix?, timezone?) → 201 workspace; quem cria vira owner
- GET /api/v1/workspaces?limit&cursor → { items, nextCursor } (só workspaces com membro ativo)
- GET /api/v1/workspaces/:wsId → { workspace, role }
- PATCH /api/v1/workspaces/:wsId (admin+; aceita settings.clickApps parcial) · DELETE /api/v1/workspaces/:wsId (owner, soft) → { success: true }
- POST /api/v1/workspaces/:wsId/transfer-ownership (owner) { userId } → membership do novo owner; antigo vira admin
- GET /api/v1/workspaces/:wsId/members → { items, nextCursor } (userId populado)
- PATCH /api/v1/workspaces/:wsId/members/:memberId (admin+) { role } · POST .../members/:memberId/deactivate (admin+)
- POST /api/v1/workspaces/:wsId/invites (admin+) { email, role } → 201 { invite, token, acceptUrl } · GET .../invites (pendentes) · DELETE .../invites/:inviteId
- POST /api/v1/invites/accept (público, 10/min/IP) { token, name?, password? } → { workspace, member, accountCreated }
- POST/GET/PATCH/DELETE /api/v1/workspaces/:wsId/teams[/:teamId] (criar/editar/remover: admin+; listar: membro)
- Swagger em /api/docs (fora de produção)
## Variáveis de ambiente
NODE_ENV, PORT, MONGODB_URI, CORS_ORIGINS, APP_URL (links de convite), JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL=15m, JWT_REFRESH_TTL=30d, COOKIE_SECURE, COOKIE_DOMAIN (ver backend/.env.example)
## Padrões aplicados
- Prefixo global api/v1, helmet, cookie-parser, CORS com credentials, body limit 1 MB, shutdown hooks, trust proxy.
- Erros: { statusCode, code, message }. Códigos de auth: UNAUTHORIZED, INVALID_CREDENTIALS, INVALID_REFRESH_TOKEN, REFRESH_TOKEN_REUSED, REFRESH_TOKEN_EXPIRED, EMAIL_IN_USE, INVALID_PASSWORD, SESSION_NOT_FOUND. De workspace: WORKSPACE_NOT_FOUND, FORBIDDEN_ROLE, MEMBER_NOT_FOUND, OWNER_ROLE_IMMUTABLE, CANNOT_CHANGE_OWN_ROLE, CANNOT_DEACTIVATE_OWNER, CANNOT_DEACTIVATE_SELF, ALREADY_OWNER, ALREADY_MEMBER, INVITE_NOT_FOUND, INVITE_EXPIRED, INVITE_ALREADY_ACCEPTED, ACCOUNT_REQUIRED, TEAM_NOT_FOUND, INVALID_TEAM_MEMBERS, INVALID_CURSOR, INVALID_ID.
- Testes: `npm test` (unit) e `npm run test:e2e` (supertest + mongodb-memory-server). O mongod sobe uma vez em test/utils/global-setup.ts (env de teste em test-env.ts); `createTestApp()` em test/utils/e2e-app.ts dá app + clearDatabase(); helpers de auth (registro, login, cookie, IP por teste) em test/utils/auth-client.ts.
## Pendências
- JWT_REFRESH_SECRET continua sem uso (refresh token é opaco, não JWT).
