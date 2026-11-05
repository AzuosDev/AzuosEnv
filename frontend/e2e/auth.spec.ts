import { expect, test } from '@playwright/test';
import { createInvite, expectNoHorizontalScroll, SEED_USER, uniqueEmail } from './helpers';

const STRONG_PASSWORD = 'Azuos2026';

test.describe('sessão', () => {
  test('login entra no workspace, recarregar mantém a sessão e sair volta ao login', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    await page.getByLabel('E-mail').fill(SEED_USER.email);
    await page.getByLabel('Senha', { exact: true }).fill(SEED_USER.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/w\/[0-9a-f]{24}$/);
    await expect(page.getByRole('heading', { name: 'Azuos Dev' })).toBeVisible();

    const workspaceUrl = page.url();

    await page.reload();
    await expect(page).toHaveURL(workspaceUrl);
    await expect(page.getByRole('heading', { name: 'Azuos Dev' })).toBeVisible();

    await page.getByRole('button', { name: 'Conta' }).click();
    await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sem sessão, uma rota protegida manda para o login guardando o destino', async ({
    page,
  }) => {
    await page.goto('/w/000000000000000000000000');

    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('a senha mostra e oculta', async ({ page }) => {
    await page.goto('/login');

    const password = page.getByLabel('Senha', { exact: true });

    await password.fill('segredo123');
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(password).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('credenciais inválidas mostram o erro do backend', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('E-mail').fill('ninguem@azuos.dev');
    await page.getByLabel('Senha', { exact: true }).fill('SenhaErrada1');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('cadastro e onboarding', () => {
  test('cria a conta, cria o workspace e entra nele', async ({ page }) => {
    const email = uniqueEmail('cadastro');

    await page.goto('/cadastro');
    await expectNoHorizontalScroll(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByLabel('Nome completo').fill('Teste Cadastro');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(STRONG_PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'Criar workspace' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByLabel('Nome do workspace').fill('Teste Cadastro Env');
    await expect(page.getByLabel('Prefixo das tarefas')).toHaveValue('TCE');

    await page.getByRole('radio', { name: 'Verde' }).check();
    await page.getByRole('button', { name: 'Criar workspace' }).click();

    await expect(page).toHaveURL(/\/w\/[0-9a-f]{24}$/);
    await expect(page.getByRole('heading', { name: 'Teste Cadastro Env' })).toBeVisible();
  });
});

test.describe('convite', () => {
  test('aceitar o convite cria a conta e permite entrar', async ({ page }) => {
    const email = uniqueEmail('convidado');
    const token = await createInvite(email);

    await page.goto(`/convite/${token}`);
    await expect(page.getByRole('heading', { name: 'Aceitar convite' })).toBeVisible();

    await page.getByLabel('Nome completo').fill('Pessoa Convidada');
    await page.getByLabel('Senha', { exact: true }).fill(STRONG_PASSWORD);
    await page.getByRole('button', { name: 'Aceitar convite' }).click();

    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(STRONG_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/w\/[0-9a-f]{24}$/);
    await expect(page.getByRole('heading', { name: 'Azuos Dev' })).toBeVisible();
  });

  test('token inválido mostra o erro do backend', async ({ page }) => {
    await page.goto('/convite/token-que-nao-existe');

    await page.getByRole('button', { name: 'Aceitar convite' }).click();

    await expect(page.getByRole('alert').first()).toBeVisible();
  });
});

test.describe('responsivo', () => {
  for (const path of ['/login', '/cadastro'] as const) {
    test(`${path} não rola para os lados em 360, 768 e 1280`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }
});
