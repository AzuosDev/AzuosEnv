# CONTEXTO-SESSAO — Azuos Env
Etapa concluída: 0 · Próxima: 1 (Setup NestJS)
## Stack
Node.js LTS, NestJS, MongoDB Atlas, Mongoose, JWT access+refresh (rotação), IA Grok (xAI). Front: React + TanStack.
## Decisões
- Multi-tenant por workspaceId; rotas /api/v1/workspaces/:wsId/...
- Refresh token em cookie httpOnly, rotacionado, com detecção de reuso.
- IDs visíveis de tarefa: PREFIXO-n (ex.: AZD-142), contador atômico por workspace.
## Módulos
(nenhum)
## Endpoints
(nenhum)
## Variáveis de ambiente
(nenhuma)
## Pendências
(nenhuma)
