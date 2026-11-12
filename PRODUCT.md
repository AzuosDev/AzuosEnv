# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dois públicos, no mesmo sistema e com a mesma linguagem visual:

- **Equipe da Azuos Dev** (primário): abre o dia nas próprias tarefas, muda status, aponta tempo, comenta e acompanha o que está em risco. Trabalha no desktop na maior parte do tempo, mas consulta e atualiza tarefas no celular.
- **Gestão da Azuos**: acompanha prazo, carga e prioridade por Quadro, Gantt, workload, sprints, timesheets e dashboards; decide o que entra e o que espera.
- **Cliente convidado**: entra para acompanhar o andamento do que contratou, comentar e aprovar entregas. Não conhece o vocabulário interno nem a estrutura toda do workspace, e vê apenas o que foi compartilhado com ele.

## Product Purpose

Sistema interno da Azuos Dev que substitui o ClickUp: um único lugar para hierarquia de trabalho (Space → Folder → List → Task), execução, tempo, documentação, conversa e acompanhamento. Sucesso é a equipe e o cliente operarem o projeto inteiro aqui, sem voltar a uma ferramenta externa e sem relatório manual para o cliente.

## Positioning

O cliente convidado é parte do processo, não destinatário de um relatório exportado: ele entra no mesmo sistema, com visão filtrada do que lhe pertence, comenta no contexto da tarefa e aprova entregas ali. É o que separa o Azuos Env de um ClickUp com link de leitura.

## Operating Context

- Multi-tenant por workspace; todo recurso vive sob `/api/v1/workspaces/:wsId/...` e recurso de outro workspace simplesmente não existe para quem pede.
- Hierarquia Space → Folder → List → Task, com views por List (Lista, Quadro, Calendário, Gantt), campos personalizados, status por List, ordem manual, arquivo (`archivedAt`) e lixeira de 30 dias (`deletedAt`).
- Módulos em operação no backend: auth e convites, workspaces e equipes, hierarquia, tarefas e colaboração, campos e views, inbox, busca, tempo real, tempo e timesheets, workload, dashboards, automações e templates, Docs com páginas aninhadas, Chat (canais, DMs, threads), planner/calendário, metas, formulários públicos, sprints, IA (Grok), whiteboards, integrações (GitHub, Google Agenda), webhooks de saída e chaves de API.
- Tempo real por socket: a tela reflete mudança de outra pessoa sem recarregar; quedas de conexão são visíveis na topbar.
- Fuso e idioma do usuário vêm do perfil; datas trafegam em UTC ISO 8601 e são apresentadas em pt-BR.
- A equipe usa desktop para operação pesada (tabela, Quadro, Gantt) e celular para consulta e atualização rápida.

## Capabilities and Constraints

- Backend concluído: 299 endpoints descritos em `docs/openapi.json`. O frontend consome só o cliente tipado gerado desse contrato; nenhum tipo de API escrito à mão.
- Access token só em memória; refresh por cookie httpOnly. 401 dispara um refresh e uma repetição; falhando, cai em `/login`.
- Estado de servidor mora apenas no TanStack Query; o socket invalida/atualiza o cache em vez de duplicar estado.
- Listas paginadas por cursor (`{ items, nextCursor }`) — a UI é feita para rolagem contínua, não para paginação numerada.
- Erros da API chegam como `{ statusCode, code, message }`; recurso de outro workspace responde 404.
- Permissão é por papel e por compartilhamento: a mesma tela mostra menos para o cliente convidado. Nenhuma tela pode assumir que todas as ações estão disponíveis.
- Frontend em etapas F0–F17; F0–F7 entregues (shell, login/cadastro, hierarquia, views Lista e Quadro, painel da tarefa, configurações). Telas ainda não implementadas respondem "Em construção".
- Textos de interface em português; código em inglês.

## Brand Commitments

- Nome: **Azuos Env**, sistema interno da **Azuos Dev**.
- Tom: profissional, direto, em português. Sem jargão de marketing dentro do produto.
- Tokens de cor da Azuos Dev (triplets RGB) são obrigatórios e fechados: nenhuma cor fora deles. Tema escuro é o padrão, claro é alternativa, com opção Sistema.
- Referência visual das telas: `docs/prototipo/<Tela>.dc.html`.
- Fonte definitiva ainda não chegou: `--font-display` está em Inter como provisória e é o único ponto de troca.

## Evidence on Hand

- `docs/openapi.json` — contrato real de 299 endpoints (gerado por `npm run openapi`).
- `docs/CONTEXTO-SESSAO.md` — estado, decisões e endpoints por etapa; fonte da verdade do projeto.
- `docs/SPEC.md` — modelo resumido do produto.
- `docs/prototipo/*.dc.html` — protótipos visuais por tela. Não existe protótipo de login, cadastro nem onboarding; essas telas foram derivadas dos tokens.
- `frontend/src/styles/globals.css` — tokens e utilitários visuais já em produção.
- Não há cliente externo, caso de uso publicado, métrica de adoção ou depoimento: é sistema interno em construção. Nada disso deve ser inventado em tela.

## Product Principles

1. **O workspace é a fronteira.** Toda leitura e escrita é filtrada por workspace e por permissão; a interface nunca sugere o que o usuário não pode alcançar.
2. **A tarefa é a unidade de trabalho.** Status, tempo, comentário, anexo e campo personalizado se resolvem no contexto da tarefa, sem desvio de tela.
3. **O cliente convidado enxerga menos, não pior.** A visão filtrada é uma tela completa e cuidada, não uma versão degradada da tela interna.
4. **Substituir o ClickUp significa não sobrar motivo para sair.** Documento, conversa e acompanhamento ficam aqui.
5. **Operação antes de expressão.** Densidade, varredura e consistência mandam nas telas de trabalho; a identidade Azuos aparece no detalhe preciso.

## Accessibility & Inclusion

- Contraste AA nos dois temas, sem exceção.
- Elementos nativos (`button`, `a`, `input` + `label`), foco sempre visível, `aria-label` em botão só de ícone.
- Alvos de toque de 44 px ou mais; nenhuma tela rola na horizontal em 360, 768 ou 1280.
- `prefers-reduced-motion` respeitado globalmente.
