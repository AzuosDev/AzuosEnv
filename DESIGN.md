---
name: Azuos Env
description: Painel de operação escuro da Azuos Dev — superfícies calmas em violeta, com um único sinal de ação.
colors:
  paper: "rgb(11 7 20)"
  paper-2: "rgb(16 11 28)"
  surface: "rgb(20 16 31)"
  surface-2: "rgb(28 22 43)"
  line: "rgb(44 36 62)"
  ink: "rgb(245 243 249)"
  body: "rgb(194 186 210)"
  muted: "rgb(156 147 173)"
  accent: "rgb(167 139 250)"
  signal: "rgb(205 190 255)"
  signal-2: "rgb(167 139 250)"
  on-signal: "rgb(22 10 46)"
  scene: "rgb(33 19 66)"
  scene-line: "rgb(72 50 124)"
  dot: "rgb(167 139 250)"
  success: "rgb(34 197 94)"
  warning: "rgb(245 158 11)"
  danger: "rgb(239 68 68)"
  info: "rgb(96 165 250)"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-signal:
    backgroundColor: "linear-gradient(100deg, rgb(205 190 255) 0%, rgb(167 139 250) 100%)"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "rgb(255 255 255)"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-nav:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  status-pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.body}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  sidebar-row:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.lg}"
    padding: "0 8px"
    height: "44px"
  sidebar-row-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  empty-state:
    backgroundColor: "{colors.scene}"
    textColor: "{colors.muted}"
    rounded: "{rounded.2xl}"
    padding: "32px"
---

# Design System: Azuos Env

## Overview

**Creative North Star: "A Sala de Controle Noturna"**

O Azuos Env é um painel de operação visto no escuro. O fundo é quase preto com veio violeta (`paper`), as superfícies de trabalho são placas calmas separadas por uma linha de 1 px, e a cor só acende onde existe decisão: a ação principal, o foco do teclado, o estado que exige atenção. Quem passa o dia aqui precisa varrer muita informação — tabela, Quadro, árvore de Spaces, painel de tarefa — então a interface se comporta como instrumentação: densa, previsível, silenciosa até ter algo a dizer.

A identidade da Azuos Dev entra pelo violeta e por um único gesto cenográfico: o par `.stage` + `.dot-grid`, que é a "cena" do sistema. Ele aparece nas telas públicas (login, cadastro, convite) e nos estados vazios, e em nenhum outro lugar. Dentro da operação as superfícies são planas e sem brilho; a profundidade vem da escada tonal `paper → paper-2 → surface → surface-2`, nunca de sombra decorativa.

O tema escuro é o padrão de verdade, não uma variação: ele está em `:root`. O claro (`[data-theme="light"]`) é alternativa completa e precisa do mesmo cuidado, com a mesma hierarquia e contraste AA. Nenhuma cor literal entra no código — toda cor vem de um token.

**Key Characteristics:**
- Escuro por padrão, claro como par de igual qualidade, com opção Sistema.
- Paleta fechada em triplets RGB consumidos como `rgb(var(--token))`.
- Violeta é sinal, não decoração: um gradiente de ação por tela.
- Superfícies planas, borda de 1 px, zero sombra ambiente.
- Densidade de ferramenta: corpo de 14 px, apoio em 13 px, rótulo em 11 px caixa alta.
- Mobile-first real: alvo de 44 px, drawer abaixo de 1024, barra inferior abaixo de 768.

## Colors

Uma família violeta sobre quase-preto, com neutros frios e quatro cores de estado emprestadas apenas para status.

### Primary
- **Violeta Azuos** (`accent`): a cor da marca em uso funcional — ícone em destaque, link, anel de foco, `caret-color`, contador do Inbox e ponto da malha. É também o `signal-2`, o fim do gradiente da ação principal.
- **Violeta Claro** (`signal`): início do gradiente do botão principal e cor do link em hover. Nunca usado como fundo de superfície.
- **Tinta sobre Sinal** (`on-signal`): o quase-preto violáceo que escreve em cima do gradiente. Único texto permitido sobre `.btn-signal`.

### Secondary
- **Cena Violeta** (`scene`) e **Linha da Cena** (`scene-line`): o fundo e a borda do palco (`.stage`). Marcam território cenográfico — telas públicas, estados vazios, pílula de menção — e o contorno do botão `outline`.
- **Ponto da Malha** (`dot`): o violeta da malha `.dot-grid`, sempre a 22% de opacidade.

### Neutral
- **Papel Noturno** (`paper`): fundo da aplicação e da topbar.
- **Papel Elevado** (`paper-2`): calhas de navegação — sidebar e barra inferior — e fundo de bloco de código.
- **Superfície** (`surface`): placa de conteúdo — cartão, diálogo, campo de formulário, linha de lista.
- **Superfície Ativa** (`surface-2`): hover, linha selecionada e código inline. É o único "estado de repouso elevado" do sistema.
- **Linha** (`line`): a borda de 1 px que separa tudo. Aplicada globalmente via `* { border-color }`.
- **Tinta** (`ink`): título, valor, texto que decide.
- **Corpo** (`body`): texto corrido e rótulo de controle.
- **Apagado** (`muted`): apoio, placeholder, ícone inativo, metadado.

### Tertiary
- **Estados** (`success`, `warning`, `danger`, `info`): só comunicam estado. Em pílula entram como borda a 40% e fundo a 15% da própria cor, com o texto na cor cheia. `danger` também veste o botão destrutivo (fundo cheio, texto branco) e o aviso de queda de conexão usa `warning`.

### Named Rules
**A Regra do Token Único.** Nenhuma cor literal no código — nem hex, nem `rgb()` cru, nem cor do Tailwind. Se a cor não existe em `globals.css`, ela não existe. Teste: buscar hex ou `rgb(` literal em `frontend/src/**/*.tsx` não retorna nada.

**A Regra do Sinal Raro.** O gradiente `.btn-signal` aparece uma vez por tela, na ação que a tela existe para provocar. Duas ações em gradiente na mesma vista são um erro de hierarquia, não uma ênfase.

**A Regra dos Dois Temas.** Toda cor nova nasce nos dois blocos (`:root` e `[data-theme='light']`) na mesma edição. Um token definido só no escuro quebra o tema claro em silêncio.

## Typography

**Display / Body / Label:** uma família só, via `--font-display`.
**Atual:** Inter, com `system-ui, sans-serif` de reserva — **provisória**. A fonte definitiva da Azuos troca em um único lugar, a variável `--font-display`.

**Character:** neutra e operacional. A personalidade vem do aperto do título (`letter-spacing: -0.02em`, `line-height: 1.02` na classe `.heading`) e do rótulo em caixa alta espaçada, não do desenho da letra.

### Hierarchy
- **Display** (600, ~24 px, 1.02, -0.02em): título de tela, via `.heading`. Um por vista.
- **Headline** (600, 18 px): título de diálogo e de seção principal.
- **Title** (600, 15 px): título de cartão; 14 px/500 na linha de lista e no item de tabela.
- **Body** (400, 14 px, 1.5): o tamanho base do `body`. Texto corrido e valor de campo.
- **Body small** (400, 13 / 13.5 px): apoio, descrição, conteúdo do editor Tiptap (13.5 px, 1.6), navegação da sidebar (13 px).
- **Label** (600, 11 px, caixa alta, 0.08em): rótulo de seção da sidebar. Em pílula e badge: 12 px/600, caixa normal.

### Named Rules
**A Regra da Escada Curta.** Seis degraus de 11 a 24 px cobrem o produto inteiro. Um tamanho fora deles precisa de motivo escrito; tipografia de marketing não entra na operação.

**A Regra do Título Apertado.** Título é `.heading` — peso 600 e `-0.02em`. Nunca peso 700, nunca caixa alta em título.

## Layout

Casca de altura fixa (`h-dvh`) com rolagem só no `<main>`; a página nunca rola na horizontal (`overflow-x: hidden` no `body`).

- **Shell desktop:** sidebar de 264 px em `paper-2` com borda à direita, topbar de ~52 px em `paper` com borda abaixo, conteúdo no restante.
- **Breakpoints:** 360 (`xs`), 768 (`md`), 1024 (`lg`), 1280+.
- **Abaixo de 1024:** a sidebar sai do fluxo e vira drawer (`Sheet` lateral) aberto pelo botão de menu da topbar; o painel da tarefa vira tela cheia.
- **Abaixo de 768:** a navegação global vira barra inferior fixa em `paper-2`, com `padding-bottom: max(env(safe-area-inset-bottom), 6px)`; o `<main>` reserva `pb-24` para ela; diálogos viram bottom sheet.
- **Ritmo:** 4 / 8 / 12 / 16 / 20 px. Cartão com 16 px no celular e 20 px a partir de `md`; shell com 12 px; diálogo com 20 px.
- **Densidade de controle:** 44 px de altura no toque, caindo a 40 px a partir de `md` (`h-11 md:h-10`). Linha de navegação usa `min-h-11` sempre.
- **Contenção:** tabela, Quadro e Gantt rolam dentro do próprio container, nunca empurrando a página. Todo texto que pode crescer vive em `min-w-0` + `truncate`.

### Named Rules
**A Regra do Zero Scroll Lateral.** Toda tela nova ganha spec Playwright que abre em 360, 768 e 1280 e falha se `document.documentElement.scrollWidth > innerWidth`.

**A Regra do Alvo de 44.** Nada clicável abaixo de 44 px no toque. Botão só de ícone é `h-11 w-11` (`md:h-10 md:w-10`) com `aria-label`.

## Elevation & Depth

Plano, com camadas tonais. Não existe sombra ambiente: a profundidade vem da escada `paper → paper-2 → surface → surface-2` mais a borda de 1 px em `line`. Uma placa "sobe" trocando de tom, não ganhando sombra.

### Shadow Vocabulary
- **Brilho do sinal** (`box-shadow: 0 10px 30px -12px rgb(var(--signal-2) / 0.7)`): exclusivo de `.btn-signal`. É a única sombra colorida do sistema e existe para ancorar a ação principal.
- **Véu de modal** (`background: rgb(0 0 0 / 0.6)` + `backdrop-filter: blur(4px)`): o overlay de diálogo e sheet. A única desfocagem do produto.
- **Cena** (`.stage`): três gradientes radiais/lineares em `scene` sobre `surface`, com `.dot-grid` por cima. Luz cenográfica, não elevação — não sinaliza camada interativa.

### Named Rules
**A Regra da Placa Plana.** Cartão, diálogo, campo e linha de lista são planos em repouso. Se uma tela parecer rasa, a resposta é trocar o tom da superfície ou reforçar a borda, nunca adicionar `box-shadow`.

## Shapes

Cantos suaves e consistentes, com três raios e um só contorno.

- **12 px (`rounded-xl`):** botão, campo, pílula de controle. O raio padrão de qualquer coisa clicável.
- **16 px (`rounded-2xl`):** cartão, diálogo, lista em bloco, estado vazio, bloco de código. O raio de "placa".
- **8 px (`rounded-lg`):** linha de navegação, botão de fechar, item de menu — elementos dentro de uma placa.
- **999 px (`rounded-full`):** pílula de status, badge de contagem, avatar, menção.
- **Borda:** sempre 1 px sólido. `line` como padrão; `scene-line` quando o elemento pertence à cena (botão `outline`, estado vazio, menção).
- **Borda por estado:** a pílula de estado usa a própria cor a 40% na borda e 15% no fundo.

### Named Rules
**A Regra dos Três Raios.** 8, 12 e 16 px (mais o pílula de 999). Um raio novo é desalinhamento, não variação.

## Components

### Buttons
- **Shape:** 12 px (`rounded-xl`), peso 600, `gap` de 8 px para o ícone, transição só de cor.
- **Tamanhos:** `sm` 36 px / 13 px · `md` 44 px (40 px em `md:`) · `lg` 48 px · `icon` quadrado de 44 px (40 px em `md:`).
- **signal (principal):** gradiente `signal → signal-2` a 100°, texto `on-signal`, sem borda, com o brilho do sinal. Hover: `brightness(1.1)`.
- **ghost:** borda `line`, fundo transparente, texto `body`. Hover: fundo `surface-2`, texto `ink`. É o secundário padrão.
- **outline:** borda `scene-line`, fundo `surface`, texto `ink`. Usado quando o botão precisa de corpo sem virar ação principal.
- **danger:** fundo `danger` cheio, texto branco. Só para destruir (apagar de vez, encerrar sessões).
- **nav:** sem borda, texto `muted`, hover em `surface-2`/`ink`. Para ícone de barra e ação de linha.
- **Desabilitado:** `opacity: 0.45` e `cursor: not-allowed`, sem mudar a cor.
- **Foco:** anel global de 2 px em `accent` com `outline-offset: 2px`. Nenhum componente remove foco.

### Inputs / Fields
- **Style:** 44 px (40 px em `md:`), fundo `surface`, borda `line`, raio 12 px, texto `ink`, placeholder `muted`.
- **Focus:** borda passa a `accent` e entra um anel de 2 px em `accent` a 25%. `caret-color` é `accent`.
- **Erro:** mensagem em `danger` abaixo do campo, ligada por `aria-describedby`; o campo não muda de cor sozinho.
- **Label:** sempre `<label>` nativo ligado ao campo. Lista simples usa `<select>` nativo (`SelectNative`) para o celular abrir o seletor do sistema; Radix Select só quando precisa de conteúdo rico.

### Cards / Containers
- **Corner Style:** 16 px (`rounded-2xl`).
- **Background:** `surface` sobre `paper`.
- **Border:** 1 px `line`. Sem sombra (ver Elevation).
- **Internal Padding:** 16 px no celular, 20 px a partir de `md`.
- **Estrutura:** título 15 px/600 em `ink`, apoio 13 px em `muted`, ações no canto superior direito. Linhas internas separadas por `border-b border-line`, a última sem borda.

### Chips
- **StatusPill:** raio 999, 12 px/600, borda de 1 px e fundo tonal. Tons: `neutral` (`surface-2`/`body`), `accent` (`scene`/`scene-line`/`ink`) e os quatro de estado a 15%/40%.
- **Badge de contagem:** círculo `accent` com texto `on-signal` em 11 px/700, altura mínima de 20 px.

### Navigation
- **Sidebar:** `paper-2`, 264 px, rótulo de seção em 11 px caixa alta `muted`, linha de item com `min-h-11`, raio 8 px, texto 13 px `body`, ícone de 16 px. Hover: `surface-2` + `ink`. Ativo: `aria-current="page"` com texto `ink`. Blocos separados por `border-t border-line`.
- **Topbar:** `paper` com borda inferior, 12 px de padding (24 px em `md`), menu à esquerda só abaixo de `lg`, ações à direita. Queda de conexão aparece como ícone em `warning`.
- **Barra inferior (< 768):** `paper-2` fixa com borda superior, ícone sobre rótulo, respeitando `safe-area-inset-bottom`.
- **Drawer (< 1024):** a mesma sidebar dentro de um `Sheet` lateral, com título em `sr-only`.

### Dialogs / Sheets
- **Desktop:** centralizado, largura máxima de 32 rem, raio 16 px, fundo `surface`, padding de 20 px, fechar de 36 px no canto com `aria-label="Fechar"`.
- **Abaixo de 768:** bottom sheet colado na base, `max-height: 90dvh`, cantos superiores em 16 px, rolagem interna.
- **Rodapé:** ações empilhadas em ordem inversa no celular (`flex-col-reverse`), alinhadas à direita a partir de `md`.

### EmptyState (componente de assinatura)
O palco do sistema: `.stage` + `.dot-grid` dentro de um bloco de 16 px de raio com borda `scene-line`, ícone em `accent`, título em `.heading` 16 px, apoio em 13 px `muted` e uma ação. É onde a identidade violeta aparece dentro da operação — e o único lugar.

### Named Rules
**A Regra da Cena Contida.** `.stage` e `.dot-grid` só nas telas públicas e no `EmptyState`. Cena atrás de conteúdo de trabalho tira legibilidade e gasta o gesto.

## Do's and Don'ts

### Do:
- **Do** usar `rgb(var(--token))` ou a classe Tailwind do token (`bg-surface`, `text-muted`, `border-line`) para toda cor.
- **Do** definir cor nova nos dois temas, na mesma edição.
- **Do** manter os três raios (8 / 12 / 16 px) e a borda de 1 px.
- **Do** dar 44 px de alvo no toque (`h-11 md:h-10`) e `aria-label` em botão só de ícone.
- **Do** deixar a profundidade na escada tonal `paper → paper-2 → surface → surface-2`.
- **Do** reservar o gradiente `.btn-signal` para uma única ação por tela.
- **Do** envolver texto variável em `min-w-0` + `truncate` e conter rolagem de tabela, Quadro e Gantt no próprio container.
- **Do** trocar a fonte apenas em `--font-display`.
- **Do** escrever a interface em português, com data, número e moeda em pt-BR no fuso do usuário.

### Don't:
- **Don't** escrever hex, `rgb()` literal ou cor do Tailwind (`bg-violet-500`, `text-white` fora do botão `danger`).
- **Don't** adicionar `box-shadow` a cartão, campo ou linha de lista: a única sombra do sistema é a do `.btn-signal`.
- **Don't** usar `.stage` ou `.dot-grid` atrás de conteúdo de trabalho.
- **Don't** colocar dois botões `signal` na mesma vista.
- **Don't** remover ou substituir o anel de foco de 2 px em `accent`.
- **Don't** criar raio, tamanho de fonte ou tom de cinza fora da escada documentada.
- **Don't** deixar a página rolar na horizontal em 360, 768 ou 1280.
- **Don't** usar título em peso 700 ou caixa alta; título é `.heading` (600, -0.02em).
- **Don't** confiar em `.sheen` como padrão: é um brilho provisório sobre os tokens de signal, pendente do `globals.css` oficial da Azuos.
