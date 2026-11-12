import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/** Larguras obrigatórias de toda tela: celular, tablet e desktop. */
export const WIDTHS = [360, 768, 1280] as const;

export const API_URL = `http://localhost:${process.env.E2E_API_PORT ?? '3100'}/api/v1`;

/** Conta criada pelo seed da API de e2e. */
export const SEED_USER = { email: 'admin@azuos.dev', password: 'Azuos2026' };

const IP_BASE = Math.floor(Math.random() * 200) + 20;
let ipCounter = 0;

/**
 * IP novo para cada chamada direta à API: o rate limit de credenciais conta por
 * IP e a API confia no X-Forwarded-For.
 */
export function nextIp(): string {
  ipCounter += 1;

  return `198.51.${String(IP_BASE)}.${String(ipCounter)}`;
}

/** Cliente HTTP direto na API (fora do navegador), para preparar cenários. */
export function apiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    extraHTTPHeaders: { 'X-Forwarded-For': nextIp() },
  });
}

interface SessionBody {
  accessToken: string;
}

interface WorkspacesBody {
  items: { id: string; name: string }[];
}

interface CreatedInviteBody {
  token: string;
}

export type InviteRole = 'admin' | 'member' | 'limited' | 'guest';

export interface Credentials {
  email: string;
  password: string;
}

/** Convida um e-mail para o workspace do seed e devolve o token do convite. */
export async function createInvite(email: string, role: InviteRole = 'member'): Promise<string> {
  const api = await apiContext();

  try {
    const session = await api.post(`${API_URL}/auth/login`, { data: SEED_USER });

    expect(session.ok(), 'login do seed na API').toBeTruthy();

    const { accessToken } = (await session.json()) as SessionBody;
    const headers = { Authorization: `Bearer ${accessToken}` };

    const workspaces = await api.get(`${API_URL}/workspaces`, { headers });
    const { items } = (await workspaces.json()) as WorkspacesBody;
    const workspace = items[0];

    expect(workspace, 'workspace do seed').toBeTruthy();

    const invite = await api.post(`${API_URL}/workspaces/${workspace?.id ?? ''}/invites`, {
      headers,
      data: { email, role },
    });

    expect(invite.ok(), 'criação do convite').toBeTruthy();

    return ((await invite.json()) as CreatedInviteBody).token;
  } finally {
    await api.dispose();
  }
}

/**
 * Conta nova já dentro do workspace do seed, montada direto pela API: cada
 * chamada sai de um IP novo, então o limite de 5 logins por minuto do navegador
 * continua livre para o que o teste precisa fazer na tela.
 */
export async function createWorkspaceMember(
  prefix: string,
  role: InviteRole = 'member',
): Promise<Credentials> {
  const credentials: Credentials = { email: uniqueEmail(prefix), password: 'Azuos2026' };
  const api = await apiContext();

  try {
    const registered = await api.post(`${API_URL}/auth/register`, {
      data: { name: `Pessoa ${prefix}`, ...credentials },
    });

    expect(registered.ok(), 'cadastro da conta de apoio').toBeTruthy();
  } finally {
    await api.dispose();
  }

  const token = await createInvite(credentials.email, role);
  const accept = await apiContext();

  try {
    const accepted = await accept.post(`${API_URL}/invites/accept`, { data: { token } });

    expect(accepted.ok(), 'aceite do convite pela API').toBeTruthy();
  } finally {
    await accept.dispose();
  }

  return credentials;
}

/**
 * Abre a sessão pela API e injeta o cookie de refresh no contexto: o app faz o
 * refresh silencioso e entra sem gastar o limite de logins do IP do navegador.
 */
export async function signInContext(
  context: BrowserContext,
  user: Credentials = SEED_USER,
): Promise<void> {
  const api = await apiContext();

  try {
    const session = await api.post(`${API_URL}/auth/login`, { data: user });

    expect(session.ok(), `login de ${user.email} na API`).toBeTruthy();

    const { cookies } = await api.storageState();

    await context.addCookies(cookies);
  } finally {
    await api.dispose();
  }
}

/** Id do workspace do seed, para abrir uma rota direto. */
export async function seedWorkspaceId(): Promise<string> {
  const api = await apiContext();

  try {
    const session = await api.post(`${API_URL}/auth/login`, { data: SEED_USER });

    expect(session.ok(), 'login do seed na API').toBeTruthy();

    const { accessToken } = (await session.json()) as SessionBody;
    const workspaces = await api.get(`${API_URL}/workspaces`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { items } = (await workspaces.json()) as WorkspacesBody;
    const workspace = items[0];

    expect(workspace, 'workspace do seed').toBeTruthy();

    return workspace?.id ?? '';
  } finally {
    await api.dispose();
  }
}

/** E-mail único por execução, para não colidir com contas já criadas. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}@azuos.dev`;
}

/**
 * Falha se a página rolar para os lados em qualquer uma das larguras.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(
      overflow.scrollWidth,
      `rolagem horizontal em ${String(width)} px (scrollWidth ${String(overflow.scrollWidth)} > innerWidth ${String(overflow.innerWidth)})`,
    ).toBeLessThanOrEqual(overflow.innerWidth);
  }
}

/** Força um tema no documento, como o ThemeProvider faria. */
export async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem('azuos-env:theme', value);
  }, theme);
}

/** Entra pela tela de login e espera a home do workspace. */
export async function signIn(page: Page, user = SEED_USER): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/w\/[0-9a-f]{24}/);
}

export interface AdminApi {
  api: APIRequestContext;
  headers: Record<string, string>;
  wsId: string;
  dispose: () => Promise<void>;
}

/** Sessão da API como a conta do seed, para montar cenários antes da tela. */
export async function adminApi(): Promise<AdminApi> {
  const api = await apiContext();
  const session = await api.post(`${API_URL}/auth/login`, { data: SEED_USER });

  expect(session.ok(), 'login do seed na API').toBeTruthy();

  const { accessToken } = (await session.json()) as SessionBody;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const workspaces = await api.get(`${API_URL}/workspaces`, { headers });
  const { items } = (await workspaces.json()) as WorkspacesBody;

  expect(items[0], 'workspace do seed').toBeTruthy();

  return {
    api,
    headers,
    wsId: items[0]?.id ?? '',
    dispose: () => api.dispose(),
  };
}

interface CreatedBody {
  id: string;
}

/** POST na API do workspace devolvendo o id do que foi criado. */
export async function createResource(
  session: AdminApi,
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await session.api.post(`${API_URL}/workspaces/${session.wsId}/${path}`, {
    headers: session.headers,
    data,
  });

  expect(response.ok(), `criação de ${path}`).toBeTruthy();

  return ((await response.json()) as CreatedBody).id;
}

export interface GoogleIdentity {
  googleId: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

/** Código que o Google falso do backend aceita (mock-google-login.provider.ts). */
export function mockGoogleCode(identity: GoogleIdentity): string {
  const payload = JSON.stringify({ emailVerified: true, ...identity });

  return `mock.${Buffer.from(payload, 'utf8').toString('base64url')}`;
}

/**
 * Percorre o login com Google com a identidade pedida: inicia o OAuth (state
 * assinado + cookie do PKCE) e troca o código do mock pelo nosso, tudo pelo
 * contexto de API — que divide os cookies com o navegador. A página só abre o
 * /auth/callback, como o navegador faria depois do 302 do backend, e nenhum
 * cabeçalho extra sobra para atrapalhar o refresh silencioso.
 * O X-Forwarded-For novo mantém o teto de 5 callbacks por minuto longe.
 */
export async function signInWithGoogle(
  page: Page,
  identity: GoogleIdentity,
  options: { next?: string; invite?: string } = {},
): Promise<void> {
  const headers = { 'X-Forwarded-For': nextIp() };
  const params = new URLSearchParams();

  if (options.next) {
    params.set('next', options.next);
  }

  if (options.invite) {
    params.set('invite', options.invite);
  }

  const query = params.toString();
  const start = await page.request.get(`${API_URL}/auth/google${query ? `?${query}` : ''}`, {
    maxRedirects: 0,
    headers,
  });

  expect(start.status(), 'início do login com o Google').toBe(302);

  const consent = new URL(start.headers().location ?? '');

  expect(
    consent.origin,
    'a API de e2e precisa do Google falso (GOOGLE_MOCK=true); derrube uma API antiga na porta da suíte',
  ).toBe(new URL(API_URL).origin);

  consent.searchParams.set('code', mockGoogleCode(identity));

  const callback = await page.request.get(consent.toString(), { maxRedirects: 0, headers });

  expect(callback.status(), 'callback do Google').toBe(302);

  const back = new URL(callback.headers().location ?? '');

  expect(back.pathname, 'destino do callback').toBe('/auth/callback');

  await page.goto(`${back.pathname}${back.search}`);
}
