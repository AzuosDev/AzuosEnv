import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
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

/** Convida um e-mail para o workspace do seed e devolve o token do convite. */
export async function createInvite(email: string): Promise<string> {
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
      data: { email, role: 'member' },
    });

    expect(invite.ok(), 'criação do convite').toBeTruthy();

    return ((await invite.json()) as CreatedInviteBody).token;
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
