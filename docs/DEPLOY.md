# Deploy — Azuos Env (backend)

## Imagem

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
docker compose up -d backend           # Mongo externo (Atlas)
docker compose --profile local up -d   # sobe também um Mongo local
```

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

## Checklist de produção

- `COOKIE_SECURE=true`, `ENCRYPTION_KEY` próprio e segredos JWT com 32+ caracteres.
- `CORS_ORIGINS` só com o domínio do front; `PUBLIC_FORM_ORIGINS` só com o site.
- Proxy/TLS na frente (a API confia em um salto: `trust proxy = 1`).
- Backup do Mongo e do volume de uploads; `GET /api/v1/workspaces/:wsId/export` (admin)
  gera o JSON completo de um workspace sob demanda.
- Uma instância só: Socket.IO, os crons e os caches de automação vivem em memória
  (escalar horizontalmente exige adapter Redis e eleição de cron).
- Contrato do front: `npm run openapi` regenera `docs/openapi.json`.
