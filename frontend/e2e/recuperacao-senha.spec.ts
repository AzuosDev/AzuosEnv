import { expect, test } from '@playwright/test';
import {
  createWorkspaceMember,
  expectNoHorizontalScroll,
  resetPathFrom,
  setTheme,
  waitForMail,
} from './helpers';

const NEW_PASSWORD = 'AzuosNova2026';

/** Larguras da F21: a ilustração só existe de 1100 px para cima. */
const WIDTHS = [360, 768, 1100, 1440] as const;

test.describe('recuperação de senha', () => {
  test('pede o link, redefine pelo e-mail e entra com a senha nova', async ({ page }) => {
    const account = await createWorkspaceMember('reset');

    await page.goto('/login');
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();

    await expect(page).toHaveURL(/\/esqueci-senha$/);
    await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();

    await page.getByLabel('E-mail').fill(account.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();
    await expect(page.getByText(account.email, { exact: false })).toBeVisible();

    const mail = await waitForMail(account.email);

    await page.goto(resetPathFrom(mail));
    await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();

    await page.getByLabel('Nova senha').fill(NEW_PASSWORD);
    await page.getByLabel('Confirmar senha').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Redefinir senha' }).click();

    await expect(page).toHaveURL(/\/login\?redefinida=true$/);
    await expect(page.getByText('Senha redefinida. Entre com a nova senha.')).toBeVisible();

    await page.getByLabel('E-mail').fill(account.email);
    await page.getByLabel('Senha', { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/w\/[0-9a-f]{24}$/);
  });

  test('o mesmo aviso aparece para e-mail sem conta', async ({ page }) => {
    await page.goto('/esqueci-senha');
    await page.getByLabel('E-mail').fill('ninguem-mesmo@azuos.dev');
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();
  });

  test('link inválido oferece pedir outro', async ({ page }) => {
    await page.goto('/redefinir-senha/token-que-nao-existe');

    await expect(
      page.getByRole('heading', { name: 'Este link expirou ou já foi usado' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Pedir outro link' }).click();
    await expect(page).toHaveURL(/\/esqueci-senha$/);
  });
});

test.describe('telas de acesso responsivas', () => {
  const paths = [
    '/login',
    '/cadastro',
    '/esqueci-senha',
    '/convite/token-que-nao-existe',
    '/redefinir-senha/token-que-nao-existe',
  ] as const;

  for (const path of paths) {
    for (const theme of ['dark', 'light'] as const) {
      test(`${path} em 360, 768, 1100 e 1440 (tema ${theme})`, async ({ page }) => {
        await page.goto(path);
        await setTheme(page, theme);
        await page.reload();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoHorizontalScroll(page, WIDTHS);
      });
    }
  }

  test('a ilustração só é desenhada a partir de 1100 px', async ({ page }) => {
    await page.goto('/login');

    const art = page.getByTestId('auth-illustration');

    for (const width of [360, 768, 1024, 1099]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(art).toHaveCount(0);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(art).toHaveCount(1);
  });
});
