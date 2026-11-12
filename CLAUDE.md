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

## Frontend (frontend/)
- Etapas do front são F0 a F17. Validar em frontend/: npm run typecheck && npm run lint && npm test && npm run test:e2e. Commit: feat(front-N): resumo.
- Stack: Vite + React + TypeScript strict; TanStack Router (rotas por arquivo), Query, Table e Virtual; Tailwind com os tokens Azuos; shadcn/ui (Radix) adaptado aos tokens; lucide-react; react-hook-form + zod; dnd-kit; Tiptap; socket.io-client; date-fns pt-BR.
- Tokens: os mesmos do globals.css da Azuos Dev em triplets RGB (--paper, --paper-2, --surface, --surface-2, --line, --ink, --body, --muted, --accent, --signal, --signal-2, --on-signal, --scene, --scene-line, --dot) + --success, --warning, --danger, --info. Tema escuro padrão em :root, claro em [data-theme="light"], opção Sistema. Nunca usar cor fora dos tokens.
- API: cliente tipado gerado de docs/openapi.json (openapi-typescript + openapi-fetch) em src/api. Nunca escrever tipos da API à mão. Nunca abrir o openapi.json inteiro: use os tipos gerados ou grep do path.
- Auth: access token só em memória; refresh por cookie httpOnly (credentials: include); 401 → um refresh e repete; falhou → /login.
- Estado do servidor só no TanStack Query (query keys em src/api/keys.ts). Socket atualiza/invalida o cache; nunca duplicar estado.
- Estrutura: src/routes, src/features/<modulo>/{components,hooks}, src/components/ui, src/lib.
- Referência visual: docs/prototipo/<Tela>.dc.html. Abra só o arquivo da tela da etapa e só quando precisar do layout.
- Responsivo (mobile-first): 360, 768, 1024 e 1280+. Abaixo de 1024: sidebar vira drawer e o painel da tarefa vira tela cheia. Abaixo de 768: navegação global vira barra inferior, diálogos viram bottom sheet; tabela, Quadro e Gantt rolam só dentro do próprio container. A página nunca rola para os lados. Alvos de toque ≥ 44 px.
- Toda tela nova ganha spec Playwright que abre em 360, 768 e 1280 e falha se document.documentElement.scrollWidth > innerWidth.
- Acessibilidade: button, a e input + label nativos; foco visível; aria-label em botão só com ícone; contraste AA nos dois temas.
- Testes: Vitest + Testing Library para regras e componentes com lógica; Playwright só para fluxos e responsividade (poucos specs, reporter line).
- Textos em português; datas, números e moeda em pt-BR, no fuso do usuário.

## Design com Impeccable (obrigatório em toda etapa do front)
- Toda tela ou componente visual novo é construído com a skill impeccable, seguindo PRODUCT.md e DESIGN.md (leia os dois só uma vez por sessão).
- Prioridade quando houver conflito: tokens e padrões do CLAUDE.md e DESIGN.md > protótipo em docs/prototipo/ > sugestões da skill. Nunca trocar cores, fonte ou tema por conta própria.
- Fluxo por etapa, nesta ordem e só nas telas da etapa:
  1. /impeccable shape quando a tela for nova (planejar antes de codar).
  2. Implementar.
  3. /impeccable adapt nas telas da etapa (360, 768, 1024, 1280).
  4. /impeccable audit nas telas da etapa; corrigir só os itens de prioridade alta.
  5. /impeccable polish como passe final.
- Comandos de estilo (bolder, quieter, colorize, animate, delight, overdrive) só quando o prompt pedir.
- Economia de tokens: não rodar critique nem audit no app inteiro; não gerar variantes (generate, live) sem pedido; relatório da skill resumido em no máximo 5 linhas na resposta final.
- Componentes repetidos em 3 ou mais telas: /impeccable extract para levar ao design system.
- A validação da etapa (typecheck, lint, test, test:e2e e o teste de rolagem horizontal) continua obrigatória depois do polish.
