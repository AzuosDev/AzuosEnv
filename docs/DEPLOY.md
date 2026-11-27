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
| `ABLY_API_KEY` | não | vazio | Tempo real do chat e das notificações. **Obrigatória em host serverless** (Vercel): com ela o servidor publica no Ably por REST e o navegador conecta lá. Vazia = gateway Socket.IO do próprio processo (Docker/Railway). Formato `<appId>.<keyId>:<secret>`. |
| `VAPID_PUBLIC_KEY` | não | vazio | Web Push (aviso com o app fechado). Gere o par com `npm run vapid` (backend). Sem ela a tela de ajustes esconde o canal Push. |
| `VAPID_PRIVATE_KEY` | não¹ | vazio | ¹ Obrigatória quando a pública está preenchida; o boot falha sem ela. **Nunca** vai para o front. |
| `VAPID_SUBJECT` | não | `mailto:no-reply@azuos.dev` | Contato exigido pelo protocolo do Web Push. |
| `COOKIE_DOMAIN` | não | vazio | Domínio do cookie quando front e API não compartilham host. |
| `UPLOAD_DIR` | não | `./storage/uploads` | Só vale sem `S3_BUCKET`; monte um volume. Em host serverless o disco é efêmero. |
| `S3_BUCKET` | em serverless | vazio | Bucket dos anexos (R2, S3, MinIO). Preenchido, troca o disco local pelo bucket. |
| `S3_ENDPOINT` | com `S3_BUCKET` fora da AWS | vazio | No R2, `https://<account_id>.r2.cloudflarestorage.com`. |
| `S3_REGION` / `S3_FORCE_PATH_STYLE` | não | `auto` / `true` | Valores do R2; na AWS use a região real. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | com `S3_BUCKET` | vazio | Obrigatórios pelo Joi quando há bucket. |
| `UPLOAD_MAX_MB` | não | `50` | Teto por arquivo (1 a 512). Qualquer tipo de arquivo é aceito. |
| `SMTP_HOST` … `SMTP_FROM` | não | vazio | Sem `SMTP_HOST` o e-mail só vai para o log. |
| `BREVO_API_KEY` | não | vazio | Com a chave o e-mail sai pela API HTTP da Brevo e o SMTP é ignorado. É o caminho recomendado em serverless. |
| `MAIL_FROM` | não | vazio | Remetente validado na Brevo (`Nome <conta@dominio>`). Vazio, vale o `SMTP_FROM`. |
| `XAI_API_KEY` | não | vazio | Vazio mantém o stub de IA (nada sai do processo). |
| `GROK_MODEL` | com `XAI_API_KEY` | vazio | Nome do modelo da xAI. |
| `AI_MONTHLY_TOKEN_BUDGET` | não | `1000000` | `0` remove o teto mensal. |
| `ENCRYPTION_KEY` | recomendada | vazio | Segredos em repouso (AES-256-GCM); vazio usa `JWT_ACCESS_SECRET`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | não | vazio | Sem o client id o calendário fica no stub. |
| `API_PUBLIC_URL` | em produção | `http://localhost:3000` | Origem pública **do backend**. É dela que sai a URL do webhook do WhatsApp (a da Meta e a que fica gravada na instância da Evolution). Errada, nenhuma mensagem chega. |
| `META_GRAPH_VERSION` | não | `v21.0` | Versão da Graph API; só a Cloud API usa. |
| `WHATSAPP_MOCK` | não | `false` | WhatsApp falso (os dois provedores) para o e2e do front. Proibido em produção pelo Joi. |
| `SEED_NAME` / `SEED_EMAIL` / `SEED_PASSWORD` | não | `admin@azuos.dev` | Apenas para `npm run seed`. |

## WhatsApp pela Evolution API v2

O provedor do WhatsApp é um campo da conexão, não do ambiente: a **Evolution API
v2** (Baileys, pareada por QR Code) é o padrão e a Cloud API oficial continua
funcionando para quem já estava nela. URL, API key e nome da instância ficam no
banco, criptografados, e são preenchidos na aba **Conexão** da Central do
WhatsApp — nada disso vira variável de ambiente aqui.

A conexão **não é oficial**: o número pode ser banido pelo WhatsApp. Evite
disparos em massa e não use o número principal da empresa como cobaia.

### 1. Subir a Evolution (Docker, Postgres e Redis)

A Evolution v2 guarda as instâncias no Postgres e o cache no Redis; sem os dois
ela perde a sessão a cada reinício e o número precisa ler o QR Code de novo.

```yaml
# docker-compose.yml do servidor da Evolution (fora deste repositório)
services:
  evolution:
    image: atendai/evolution-api:v2.3.7
    restart: always
    ports:
      - '8080:8080'
    environment:
      SERVER_URL: https://evolution.seu-dominio.com.br
      AUTHENTICATION_API_KEY: <chave-global-forte>
      DATABASE_ENABLED: 'true'
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://evolution:<senha>@postgres:5432/evolution
      DATABASE_SAVE_DATA_INSTANCE: 'true'
      DATABASE_SAVE_DATA_NEW_MESSAGE: 'true'
      DATABASE_SAVE_MESSAGE_UPDATE: 'true'
      CACHE_REDIS_ENABLED: 'true'
      CACHE_REDIS_URI: redis://redis:6379/6
      CACHE_REDIS_PREFIX_KEY: evolution
      CACHE_LOCAL_ENABLED: 'false'
      CONFIG_SESSION_PHONE_VERSION: '2.3000.1023204200'
      DEL_INSTANCE: 'false'
    volumes:
      - evolution_instances:/evolution/instances
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: <senha>
      POSTGRES_DB: evolution
    volumes:
      - evolution_pg:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - evolution_redis:/data

volumes:
  evolution_instances:
  evolution_pg:
  evolution_redis:
```

```bash
docker compose up -d
curl -s https://evolution.seu-dominio.com.br/ -H 'apikey: <chave-global-forte>'
```

Ponha TLS na frente (Traefik, Caddy ou Nginx) e **não** exponha a porta 8080 na
internet sem ele: a `AUTHENTICATION_API_KEY` é a única barreira.

### 2. Deixar o backend alcançável

```
API_PUBLIC_URL=https://api.azuosdev.com.br
```

O webhook da instância é montado a partir dessa origem:

```
POST {API_PUBLIC_URL}/api/v1/integrations/whatsapp/evolution/{connectionId}/{webhookSecret}
```

O segredo nasce ao salvar a conexão, fica criptografado no banco e é conferido
por hash em cada entrega; segredo errado responde 404, igual a conexão
desconhecida. A rota é pública, então o servidor da Evolution precisa alcançar
essa URL — em rede privada, exponha o backend ou coloque os dois na mesma rede
do Docker.

### 3. Conectar o número

Na Central do WhatsApp › **Conexão** (gestor):

1. provedor **Evolution (QR Code)**, URL do servidor, API key e nome da instância;
2. **Salvar conexão** e depois **Conectar** — o backend cria a instância na
   integração Baileys já com o webhook apontado para cá e mostra o QR Code;
3. leia o QR Code no WhatsApp do celular (Aparelhos conectados › Conectar
   aparelho). A tela troca para **Conectado** sozinha, com número e nome do
   perfil, assim que a Evolution avisa pelo webhook;
4. **Desconectar** encerra a sessão e **Reiniciar** recria a conexão da
   instância sem apagar o pareamento.

Com a Evolution não existe janela de 24 h nem template aprovado: o envio é livre.
Um cron confere o estado da instância a cada 5 minutos e, na queda, marca
**Desconectado** na Central, avisa os gestores no Inbox e publica o evento em
tempo real.

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

### Vercel (dois projetos `*.vercel.app`)

Hoje o app está em `azuosenv.vercel.app` e a API em `azuosenv-api.vercel.app`. Como
`vercel.app` está na Public Suffix List, **cada subdomínio é um site diferente**: o
cookie de refresh gravado pela API é cookie de terceiros para o app e o navegador não
o envia no `POST /api/v1/auth/refresh`. O login por senha parece funcionar (o access
token vem no corpo), mas o refresh silencioso falha e o login com Google morre em
`/login?erro=google`, porque ele depende só do cookie.

A saída sem domínio próprio é fazer a API responder **na mesma origem do app**, pelo
rewrite de `frontend/vercel.json`:

```json
{ "source": "/api/:path*", "destination": "https://azuosenv-api.vercel.app/api/:path*" }
```

Com isso nada mais é terceira parte. As variáveis mudam assim:

| Onde | Variável | Valor |
| --- | --- | --- |
| Vercel → frontend | `VITE_API_URL` | `https://azuosenv.vercel.app` (a própria origem do app) |
| Vercel → backend | `GOOGLE_LOGIN_REDIRECT_URI` | `https://azuosenv.vercel.app/api/v1/auth/google/callback` |
| Vercel → backend | `CORS_ORIGINS`, `APP_URL`, `FRONTEND_URL` | `https://azuosenv.vercel.app` |
| Vercel → backend | `COOKIE_SECURE` / `COOKIE_SAME_SITE` / `COOKIE_DOMAIN` | `true` / `none` (ou `lax`, já que agora é mesma origem) / vazio |

A URI nova do login tem que entrar em "URIs de redirecionamento autorizados" do client
OAuth no Console do Google; a antiga (`azuosenv-api.vercel.app/...`) pode ficar.

### Tempo real na Vercel (Ably)

O gateway Socket.IO **não funciona nessa hospedagem**: função serverless não mantém
WebSocket. Por isso o tempo real é uma camada com dois transportes (`RealtimeService`):

| Hospedagem | Transporte | Como ligar |
| --- | --- | --- |
| Vercel (serverless) | Ably | `ABLY_API_KEY` no projeto da **API** |
| Docker / Railway (processo longo) | Socket.IO | deixar `ABLY_API_KEY` vazia |

Os pacotes são `@ably/pubsub-server` (API) e `@ably/pubsub-device` (navegador), **não** o
`ably`: conta cobrada por usuário ativo (MAU) recusa o SDK antigo com o erro 40168, e a
separação marca o tráfego do servidor como isento da contagem — só a conexão do navegador
conta como usuário ativo.

Na Vercel, sem `ABLY_API_KEY` **o app não recebe nada em tempo real**: a aba cai na
reserva de sincronização (busca a cada 30 s com a aba visível) e o aviso fora do app
depende do Web Push. Com a chave, o servidor publica por REST dentro do próprio request
que salvou o dado, e o navegador conecta no Ably com token pedido em
`POST /api/v1/realtime/token` — recortado nos canais do usuário (`user:{id}`,
`ws:{wsId}` dos workspaces ativos e `channel:{id}` dos canais visíveis), com 1 h de
validade. A chave do Ably fica só no servidor; o front nunca a vê.

Digitação ("digitando…"), presença na tarefa e a edição ao vivo do quadro continuam só
no transporte Socket.IO: são do cliente para o servidor. O rewrite de `/ws/:path*` fica
pronto para quando a API rodar em host de conexão longa.

O rewrite não cria limite novo de upload: o backend já é uma Vercel Function, então o
teto de 4,5 MB de corpo vale igual com ou sem proxy.

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
- WhatsApp: `API_PUBLIC_URL` com a URL pública do backend, Evolution com TLS e
  `AUTHENTICATION_API_KEY` forte, e Postgres e Redis dela em volume (sem eles a
  sessão do número cai a cada reinício).
- Frontend: `VITE_API_URL` apontando para a API, `COOKIE_DOMAIN` no domínio comum e
  HTTPS nos dois hosts (sem isso não há Service Worker nem sessão persistente).
