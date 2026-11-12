import { expect, test } from '@playwright/test';
import { adminApi, expectNoHorizontalScroll, signInContext, type AdminApi } from './helpers';

let session: AdminApi;

test.beforeAll(async () => {
  session = await adminApi();
});

test.afterAll(async () => {
  await session.dispose();
});

test('o aviso de sem conexão aparece e some com a rede', async ({ browser }) => {
  const context = await browser.newContext();

  await signInContext(context);

  const page = await context.newPage();
  const warning = page.getByText('Você está sem conexão.', { exact: false });

  await page.goto(`/w/${session.wsId}`);
  await expect(page.locator('#conteudo')).toBeVisible();
  await expect(warning).toBeHidden();

  await context.setOffline(true);
  await expect(warning).toBeVisible();

  await context.setOffline(false);
  await expect(warning).toBeHidden();

  await context.close();
});

test('falha de rede na rota cai no error boundary com "Tentar de novo"', async ({ browser }) => {
  const context = await browser.newContext();

  await signInContext(context);

  const page = await context.newPage();

  // A rota de auditoria carrega os membros no loader; derrubar a chamada
  // derruba a rota, não o app.
  await page.route('**/api/v1/workspaces/*/members**', (route) => route.abort('failed'));
  await page.goto(`/w/${session.wsId}/configuracoes/auditoria`);

  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();

  await page.unroute('**/api/v1/workspaces/*/members**');
  await page.getByRole('button', { name: 'Tentar de novo' }).click();

  await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeHidden();

  await context.close();
});

test('sessão expirada: a API nega o refresh e o login avisa', async ({ browser }) => {
  const context = await browser.newContext();

  await signInContext(context);

  const page = await context.newPage();

  await page.goto(`/w/${session.wsId}/configuracoes/perfil`);
  await expect(page.locator('#conteudo')).toBeVisible();

  const unauthorized = {
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Sessão expirada.' }),
  };

  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill(unauthorized));
  await page.route('**/api/v1/workspaces/*/members**', (route) => route.fulfill(unauthorized));

  await page.getByRole('link', { name: 'Pessoas' }).click();

  await page.waitForURL(/\/login/);
  await expect(page.getByRole('alert')).toContainText('Sua sessão expirou');

  await context.close();
});

test('a página offline do Service Worker é amigável nas três larguras', async ({ page }) => {
  await page.goto('/offline.html');

  await expect(page.getByRole('heading', { name: 'Você está sem conexão' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('os ícones e a página offline são servidos', async ({ request }) => {
  for (const path of [
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/icon.svg',
    '/favicon.svg',
    '/offline.html',
  ]) {
    const response = await request.get(path);

    expect(response.status(), path).toBe(200);
  }
});
