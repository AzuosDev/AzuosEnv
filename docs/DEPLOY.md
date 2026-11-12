# Deploy — Azuos Env

## Imagem do backend

```bash
docker build -t azuos-env-backend ./backend
docker run --env-file ./backend/.env -p 3000:3000 azuos-env-backend
```

O Dockerfile é multi-stage (deps → build → runtime): a imagem final roda como usuário
`node`, só com `dist/` e as dependências de produção, expõe a porta 3000 e tem
healthcheck em `GET /api/v1/health`. Os uploads ficam no volume `/app/storage/uploads`.

## docker compose

```bash
cp backend/.env.example backend/.env   # preencha os segredos
docker compose build                   # backend + frontend
docker compose up -d backend frontend  # Mongo externo (Atlas)
docker compose --profile local up -d   # sobe também um Mongo local
```

O `frontend` publica a porta 8080 (nginx) e o `backend` a 3000. Em produção os dois
ficam atrás do proxy/TLS, cada um no seu host.

O serviço `mongo` está no profile `local` e só sobe quando pedido; em produção
aponte `MONGODB_URI` para o Atlas.

## Variáveis de ambiente

Fonte completa: `backend/.env.example`. Obrigatórias e mais relevantes:

| Variável | Obrigatória | Padrão | Observação |
| --- | --- | --- | --- |
| `NODE_ENV` | não | `development` | `production` desliga o Swagger (`/api/docs`). |
| `PORT` | não | `3000` | |
| `LOG_LEVEL` | não | `info` | Log estruturado (nestjs-pino) com `requestId`. |
| `MONGODB_URI` | **sim** | — | `mongodb://` ou `mongodb+srv://`. |
| `CORS_ORIGINS` | não | `http://localhost:5173` | Lista separada por vírgula; o front vai aqui. |
| `PUBLIC_FORM_ORIGINS` | não | vazio | Origens que podem abrir e enviar formulário público. |
| `APP_URL` | não | `http://localhost:5173` | Base dos links de convite e deep links. |
| `JWT_ACCESS_SECRET` | **sim** | — | Mínimo 16 caracteres. |
| `JWT_REFRESH_SECRET` | **sim** | — | Mínimo 16 caracteres. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | não | `15m` / `30d` | |
| `COOKIE_SECURE` | não | `false` | **`true` em produção** (cookie do refresh por HTTPS). |
| `COOKIE_DOMAIN` | não | vazio | Domínio do cookie quando front e API não compartilham host. |
| `UPLOAD_DIR` | não | `./storage/uploads` | Monte um volume; trocar por S3/R2 é só outro provider. |
| `SMTP_HOST` … `SMTP_FROM` | não | vazio | Sem `SMTP_HOST` o e-mail só vai para o log. |
| `BREVO_API_KEY` | não | vazio | Com a chave o e-mail sai pela API HTTP da Brevo e o SMTP é ignorado. É o caminho recomendado em serverless. |
| `MAIL_FROM` | não | vazio | Remetente validado na Brevo (`Nome <conta@dominio>`). Vazio, vale o `SMTP_FROM`. |
| `XAI_API_KEY` | não | vazio | Vazio mantém o stub de IA (nada sai do processo). |
| `GROK_MODEL` | com `XAI_API_KEY` | vazio | Nome do modelo da xAI. |
| `AI_MONTHLY_TOKEN_BUDGET` | não | `1000000` | `0` remove o teto mensal. |
| `ENCRYPTION_KEY` | recomendada | vazio | Segredos em repouso (AES-256-GCM); vazio usa `JWT_ACCESS_SECRET`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | não | vazio | Sem o client id o calendário fica no stub. |
| `SEED_NAME` / `SEED_EMAIL` / `SEED_PASSWORD` | não | `admin@azuos.dev` | Apenas para `npm run seed`. |

## Primeiro boot

```bash
cd backend
npm ci
npm run build
npm run seed     # workspace Azuos Dev (AZD) com o conteúdo do protótipo
npm run start:prod
```

## Frontend

```bash
docker build -t azuos-env-frontend --build-arg VITE_API_URL=https://api.azuosdev.com.br ./frontend
docker run -p 8080:80 azuos-env-frontend
```

Multi-stage: `node:24` roda `npm run build` (typecheck, Vite e o teto de 250 KB gzip
da entrada inicial) e a imagem final é um `nginx:1.27-alpine` com os estáticos.
O `nginx.conf` traz fallback de SPA (`try_files … /index.html`), gzip, cache imutável
de um ano em `/assets/` e `no-cache` em `index.html`, `sw.js`, `registerSW.js` e
`manifest.webmanifest` — assim a versão nova chega sem limpar o cache do navegador.

**`VITE_API_URL` é build-arg, não variável de runtime**: a URL entra no bundle. Trocar
de ambiente significa reconstruir a imagem (ou usar uma tag por ambiente).

### Domínios e cookie

O refresh é um cookie `httpOnly` com `SameSite=Lax` no path `/api/v1/auth`. Para o
navegador mandá-lo, o app e a API precisam do **mesmo site registrável**:

| | Produção |
| --- | --- |
| App | `https://app.azuosdev.com.br` (imagem `frontend`) |
| API | `https://api.azuosdev.com.br` (imagem `backend`) |

No backend:

```env
CORS_ORIGINS=https://app.azuosdev.com.br
APP_URL=https://app.azuosdev.com.br
COOKIE_SECURE=true
COOKIE_DOMAIN=.azuosdev.com.br
```

No build do frontend: `VITE_API_URL=https://api.azuosdev.com.br`.

Sem `COOKIE_DOMAIN` o cookie fica preso em `api.azuosdev.com.br` e o refresh silencioso
falha — a sessão cai no primeiro reload. Domínios de sites diferentes (por exemplo
`app.azuos.dev` com `api.outracoisa.com`) exigiriam `SameSite=None`, fora do escopo.

### PWA

`vite-plugin-pwa` gera `sw.js` e `manifest.webmanifest` no build. O Service Worker
guarda o shell, os assets e as fontes do Google; **nenhuma resposta da API é cacheada**
(`navigateFallbackDenylist` cobre `/api/` e não há runtime cache do domínio da API).
Sem rede, a navegação cai no shell e, se nem ele estiver em cache, em `offline.html`.
Exige HTTPS (ou `localhost`): sem TLS o navegador não registra o Service Worker e o app
não fica instalável.

### Relatório de bundle

Todo `npm run build` escreve `frontend/bundle-stats.html` (treemap com gzip) e falha se
a entrada inicial passar de 250 KB gzip (hoje ~195 KB).

## Checklist de produção

- `COOKIE_SECURE=true`, `ENCRYPTION_KEY` próprio e segredos JWT com 32+ caracteres.
- `CORS_ORIGINS` só com o domínio do front; `PUBLIC_FORM_ORIGINS` só com o site.
- Proxy/TLS na frente (a API confia em um salto: `trust proxy = 1`).
- Backup do Mongo e do volume de uploads; `GET /api/v1/workspaces/:wsId/export` (admin)
  gera o JSON completo de um workspace sob demanda.
- Uma instância só: Socket.IO, os crons e os caches de automação vivem em memória
  (escalar horizontalmente exige adapter Redis e eleição de cron).
- Contrato do front: `npm run openapi` regenera `docs/openapi.json`.
- Frontend: `VITE_API_URL` apontando para a API, `COOKIE_DOMAIN` no domínio comum e
  HTTPS nos dois hosts (sem isso não há Service Worker nem sessão persistente).
