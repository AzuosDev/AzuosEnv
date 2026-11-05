import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, signIn } from './helpers';

/**
 * Uma única sessão para todo o arquivo: o login tem limite de 5 por minuto por
 * IP e o navegador sempre sai do mesmo IP.
 */
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();

  page = await context.newPage();
  await signIn(page);
});

test.afterAll(async () => {
  await page.context().close();
});

test.beforeEach(async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('a árvore da sidebar navega até uma List e guarda o que foi expandido', async () => {
  await page.goto('/');
  await page.waitForURL(/\/w\/[0-9a-f]{24}$/);

  await page.getByRole('button', { name: 'Expandir Clientes' }).click();
  await page.getByRole('button', { name: 'Expandir Cênio Construções' }).click();

  const list = page.getByRole('link', { name: /uSolutionsPDV — Sprint 3/ });

  await expect(list).toBeVisible();
  await list.click();

  await expect(page).toHaveURL(/\/l\/[0-9a-f]{24}$/);
  await expect(page.getByRole('heading', { name: 'uSolutionsPDV — Sprint 3' })).toBeVisible();

  const trail = page.getByRole('navigation', { name: 'Trilha' });

  await expect(trail.getByRole('link', { name: 'Clientes' })).toBeVisible();
  await expect(trail.getByRole('link', { name: 'Cênio Construções' })).toBeVisible();

  // Expandir/recolher fica salvo: depois do reload a List continua à vista.
  await page.reload();
  await expect(page.getByRole('link', { name: /uSolutionsPDV — Sprint 3/ })).toBeVisible();

  await page.getByRole('button', { name: 'Recolher Clientes' }).click();
  await expect(page.getByRole('link', { name: /uSolutionsPDV — Sprint 3/ })).toBeHidden();
});

test('o Space abre com breadcrumb e o módulo futuro abre Em construção', async () => {
  await page.goto('/');
  await page.waitForURL(/\/w\/[0-9a-f]{24}$/);

  await page.getByRole('link', { name: 'Comercial' }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f]{24}$/);
  await expect(page.getByRole('heading', { name: 'Comercial' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Navegação global' })
    .getByRole('link', { name: 'Planner' })
    .click();

  await expect(page).toHaveURL(/\/planner$/);
  await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible();
  await expect(page.getByText('Em construção')).toBeVisible();
});

test('no celular a sidebar vira drawer e fecha ao navegar', async () => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.waitForURL(/\/w\/[0-9a-f]{24}$/);

  const drawer = page.getByRole('dialog', { name: 'Navegação do workspace' });

  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await expect(drawer).toBeVisible();

  const comercial = drawer.getByRole('button', { name: /Comercial$/ });

  if ((await comercial.getAttribute('aria-expanded')) !== 'true') {
    await comercial.click();
  }

  await drawer.getByRole('link', { name: 'Leads', exact: true }).click();

  await expect(page).toHaveURL(/\/l\/[0-9a-f]{24}$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
});

test('abaixo de 768 a navegação global vira barra inferior com Mais', async () => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.waitForURL(/\/w\/[0-9a-f]{24}$/);

  const bottom = page.getByRole('navigation', { name: 'Navegação global' });

  await expect(bottom.getByRole('link', { name: 'Tarefas' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Timesheets' })).toBeHidden();

  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('link', { name: 'Timesheets' }).click();

  await expect(page).toHaveURL(/\/timesheets$/);
  await expect(page.getByRole('heading', { name: 'Timesheets' })).toBeVisible();
});

test('o shell não rola para os lados em 360, 768 e 1280', async () => {
  await page.goto('/');
  await page.waitForURL(/\/w\/[0-9a-f]{24}$/);
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('link', { name: 'Comercial' }).click();
  await page.waitForURL(/\/s\/[0-9a-f]{24}$/);
  await expectNoHorizontalScroll(page);
});
