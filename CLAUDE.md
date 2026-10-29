# Azuos Env — regras do Claude Code
Sistema interno da Azuos Dev que substitui o ClickUp. Projeto dividido em duas pastas: backend/ (NestJS) e frontend/ (React). Código do backend só em backend/; código do front só em frontend/. Nesta fase só backend/ é implementado.
Fonte da verdade do estado: docs/CONTEXTO-SESSAO.md. Modelo resumido: docs/SPEC.md.

## Economia de tokens (obrigatório)
- Leia só CLAUDE.md, docs/CONTEXTO-SESSAO.md e os arquivos que a etapa exige. Não liste nem explore o repositório; use grep direcionado.
- Não releia arquivos que acabou de escrever. Nunca abra node_modules, dist ou lockfiles.
- Não explique código, não faça resumos longos, não sugira melhorias fora do escopo.
- Não pergunte o que dá para decidir pelo CONTEXTO-SESSAO.md ou pelo padrão do código. Pergunte só se bloqueado.
- Rode só os comandos de validação; use saída silenciosa e mostre só erros. Em erro, corrija o mínimo e rode de novo.
- Resposta final: no máximo 5 linhas (feito, validação, pendências).

## Fluxo de cada etapa
1. Implementar só o escopo da etapa; nada de etapas futuras.
2. Validar em backend/: npm run build && npm run lint && npm test && npm run test:e2e. Tudo verde.
3. Atualizar docs/CONTEXTO-SESSAO.md de forma concisa (estado, decisões, endpoints, env, próxima etapa).
4. Commit: feat(etapa-N): resumo. Sem validação verde: sem commit e sem avançar.

## Padrões do backend
- NestJS modular: src/modules/<modulo>/{schemas,dto,*.controller.ts,*.service.ts,*.module.ts}; comum em src/common.
- Mongoose tipado. Toda coleção de dados tem workspaceId indexado e toda query filtra por ele.
- DTOs com class-validator; ValidationPipe global (whitelist, forbidNonWhitelisted, transform).
- Rotas /api/v1; recursos do workspace em /api/v1/workspaces/:wsId/...
- Listas paginadas por cursor: { items, nextCursor }.
- Soft delete com deletedAt (lixeira 30 dias); arquivo com archivedAt; ordem manual com position (fractional indexing).
- Datas em UTC ISO 8601; fuso do usuário no perfil.
- Erros: filtro global { statusCode, code, message }. Recurso de outro workspace responde 404.
- Toda escrita relevante emite evento de domínio (@nestjs/event-emitter) a partir da Etapa 5.
- Testes: unitário para regra de negócio; e2e (supertest + mongodb-memory-server) para cada endpoint novo: sucesso, permissão negada e validação.
- Segredos só em .env; .env.example sempre atualizado.
- Código em inglês; mensagens ao usuário em português.

## Front (depois do backend)
React + TanStack, 100% responsivo (celular, tablet, desktop), seguindo o protótipo Azuos Env e os tokens do globals.css da Azuos Dev (escuro padrão + claro).
