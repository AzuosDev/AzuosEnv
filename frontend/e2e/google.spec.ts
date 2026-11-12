import { expect, test } from '@playwright/test';
import {
  API_URL,
  createInvite,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  seedWorkspaceId,
  setTheme,
  signInWithGoogle,
  uniqueEmail,
  WIDTHS,
} from './helpers';

const STRONG_PASSWORD = 'Azuos2026';
const ACCESS_PATHS = ['/login', '/cadastro', '/convite/token-de-teste'] as const;

test.describe('entrar com o Google', () => {
  test('conta nova pelo convite entra, define senha e desconecta o Google', async ({ page }) => {
    const email = uniqueEmail('google-nova');
    const invite = await createInvite(email);

    await signInWithGoogle(
      page,
      { googleId: `mock-nova-${email}`, email, name: 'Conta Nova' },
      {
        invite,
      },
    );

    // O convite entra junto com o login: cai direto no workspace do seed.
    await expect(page).toHaveURL(/\/w\/[0-9a-f]{24}$/);
    await expect(page.getByRole('heading', { name: 'Azuos Dev' })).toBeVisible();

    const wsId = /\/w\/([0-9a-f]{24})/.exec(page.url())?.[1] ?? '';

    await page.goto(`/w/${wsId}/configuracoes/seguranca`);

    // Sem senha ainda: o cartão é "definir" e o Google não pode ser desconectado.
    await expect(page.getByRole('button', { name: 'Definir senha' })).toBeVisible();
    await expect(page.getByText('Conectada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desconectar Google' })).toHaveCount(0);

    await page.getByLabel('Nova senha').fill(STRONG_PASSWORD);
    await page.getByLabel('Repetir a senha').fill(STRONG_PASSWORD);
    await page.getByRole('button', { name: 'Definir senha' }).click();

    await expect(page.getByText('Senha definida.', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Senha atual')).toBeVisible();

    await page.getByRole('button', { name: 'Desconectar Google' }).click();
    await page.getByRole('button', { name: 'Desconectar', exact: true }).click();

    await expect(page.getByText('Conta do Google desconectada.')).toBeVisible();
    await expect(page.getByText('Não conectada')).toBeVisible();
  });

  test('conta existente é vinculada pelo e-mail e cai no workspace', async ({ page }) => {
    const member = await createWorkspaceMember('google-existente');

    await signInWithGoogle(page, {
      googleId: `mock-existente-${member.email}`,
      email: member.email,
      name: 'Conta Existente',
    });

    await expect(page).toHaveURL(/\/w\/[0-9a-f]{24}$/);

    const wsId = /\/w\/([0-9a-f]{24})/.exec(page.url())?.[1] ?? '';

    await page.goto(`/w/${wsId}/configuracoes/seguranca`);

    // Já tinha senha: troca de senha de sempre e o Google pode sair.
    await expect(page.getByLabel('Senha atual')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desconectar Google' })).toBeEnabled();
  });

  test('o botão respeita o destino pedido em ?next=', async ({ page }) => {
    const member = await createWorkspaceMember('google-next');
    const wsId = await seedWorkspaceId();

    await signInWithGoogle(
      page,
      { googleId: `mock-next-${member.email}`, email: member.email },
      { next: `/w/${wsId}/inbox` },
    );

    await expect(page).toHaveURL(new RegExp(`/w/${wsId}/inbox$`));
  });

  test('falha do Google volta ao login com a mensagem', async ({ page }) => {
    await page.goto(`${API_URL}/auth/google/callback?code=nada&state=invalido`);

    await expect(page).toHaveURL(/\/login\?erro=google$/);
    await expect(page.getByRole('alert').first()).toContainText(
      'Não foi possível entrar com o Google',
    );
  });

  test('/login?erro=google mostra a mesma mensagem', async ({ page }) => {
    await page.goto('/login?erro=google');

    await expect(page.getByRole('alert').first()).toContainText(
      'Não foi possível entrar com o Google',
    );
  });

  test('clicar no botão da tela de login abre a sessão', async ({ page }) => {
    await page.goto('/login');

    const button = page.getByTestId('google-login');

    await expect(button).toHaveAttribute('href', /\/api\/v1\/auth\/google$/);
    await button.click();

    await expect(page).toHaveURL(/\/onboarding$|\/w\/[0-9a-f]{24}$|\/workspaces$/);
  });

  test('no convite o botão leva o token do convite', async ({ page }) => {
    await page.goto('/convite/token-de-teste');

    await expect(page.getByTestId('google-login')).toHaveAttribute(
      'href',
      /\/api\/v1\/auth\/google\?invite=token-de-teste$/,
    );
  });
});

test.describe('responsivo do botão do Google', () => {
  for (const path of ACCESS_PATHS) {
    for (const theme of ['dark', 'light'] as const) {
      test(`${path} mostra o botão em 360, 768 e 1280 (tema ${theme})`, async ({ page }) => {
        await page.goto(path);
        await setTheme(page, theme);
        await page.reload();

        const button = page.getByTestId('google-login');

        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await expect(button).toBeVisible();

          const box = await button.boundingBox();

          expect(box?.height ?? 0, `alvo de toque em ${String(width)} px`).toBeGreaterThanOrEqual(
            44,
          );
        }

        await expectNoHorizontalScroll(page);
      });
    }
  }
});
