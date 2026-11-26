import { expect, test, type BrowserContext } from '@playwright/test';
import { expectNoHorizontalScroll, seedWorkspaceId, signInContext } from './helpers';

let wsId: string;

test.beforeAll(async () => {
  wsId = await seedWorkspaceId();
});

/**
 * Navegador que ainda não decidiu sobre o aviso do sistema. O Chromium do
 * Playwright já responde a permissão sem perguntar, então o teste troca a API
 * por uma que começa em `default` e grava o pedido.
 */
async function undecidedBrowser(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    class FakeNotification {
      static permission = 'default';

      static requestPermission(): Promise<string> {
        FakeNotification.permission = 'granted';
        Object.assign(window, { __pushAsked: true });

        return Promise.resolve('granted');
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: FakeNotification,
    });
  });
}

test('o convite de notificações aparece ao entrar e pede a permissão no clique', async ({
  browser,
}) => {
  const context = await browser.newContext();

  await undecidedBrowser(context);
  await signInContext(context);

  const page = await context.newPage();
  const banner = page.getByRole('region', { name: 'Notificações do sistema' });

  await page.goto(`/w/${wsId}`);
  await expect(page.locator('#conteudo')).toBeVisible();
  await expect(banner).toBeVisible();

  await expectNoHorizontalScroll(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await banner.getByRole('button', { name: 'Ativar notificações' }).click();

  await expect(page.getByText('Avisos do sistema liberados neste navegador.')).toBeVisible();
  await expect(banner).toBeHidden();
  expect(await page.evaluate(() => '__pushAsked' in window)).toBe(true);

  await context.close();
});

test('"Agora não" adia o convite e ele não volta no recarregar', async ({ browser }) => {
  const context = await browser.newContext();

  await undecidedBrowser(context);
  await signInContext(context);

  const page = await context.newPage();
  const banner = page.getByRole('region', { name: 'Notificações do sistema' });

  await page.goto(`/w/${wsId}`);
  await expect(banner).toBeVisible();

  await banner.getByRole('button', { name: 'Agora não' }).click();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(page.locator('#conteudo')).toBeVisible();
  // A permissão volta a "default" no recarregar, mas o adiamento vale 14 dias.
  await page.waitForTimeout(1600);
  await expect(banner).toBeHidden();

  await context.close();
});
