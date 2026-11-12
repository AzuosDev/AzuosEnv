import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminApi, API_URL, createResource, signInContext, type AdminApi } from './helpers';

let session: AdminApi;
let wsId: string;
let page: Page;
let spaceId: string;
let routes: { slug: string; path: string }[] = [];

/** Violações sérias ou críticas em qualquer rota principal reprovam a etapa. */
const BLOCKING = new Set(['serious', 'critical']);

interface Violation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: { target: unknown[]; html: string }[];
}

async function blockingViolations(target: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page: target })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // O canvas do Excalidraw e o editor do Tiptap têm DOM próprio, fora do app.
    .exclude('.excalidraw')
    .analyze();

  return (result.violations as Violation[])
    .filter((violation) => BLOCKING.has(violation.impact ?? ''))
    .map(
      (violation) =>
        `${violation.id} (${String(violation.impact)}): ${violation.help} — ${violation.nodes
          .map((node) => node.html)
          .slice(0, 4)
          .join(' | ')}`,
    );
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  spaceId = await createResource(session, 'spaces', {
    name: `Acessibilidade ${String(Date.now())}`,
    statusTemplate: 'simples',
  });

  const listId = await createResource(session, 'lists', { spaceId, name: 'Lista' });
  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name: 'Tarefa acessível' },
  });

  expect(created.ok(), 'criação da tarefa do axe').toBeTruthy();

  const { customId } = (await created.json()) as { customId: string };
  const ws = `/w/${wsId}`;

  routes = [
    { slug: 'home', path: ws },
    { slug: 'inbox', path: `${ws}/inbox` },
    { slug: 'minhas-tarefas', path: `${ws}/minhas-tarefas` },
    { slug: 'tudo', path: `${ws}/tudo` },
    { slug: 'planner', path: `${ws}/planner` },
    { slug: 'metas', path: `${ws}/metas` },
    { slug: 'docs', path: `${ws}/docs` },
    { slug: 'chat', path: `${ws}/chat` },
    { slug: 'ia', path: `${ws}/ia` },
    { slug: 'whiteboards', path: `${ws}/whiteboards` },
    { slug: 'dashboards', path: `${ws}/dashboards` },
    { slug: 'automacoes', path: `${ws}/automacoes` },
    { slug: 'timesheets', path: `${ws}/timesheets` },
    { slug: 'lixeira', path: `${ws}/lixeira` },
    { slug: 'lista', path: `${ws}/l/${listId}` },
    { slug: 'tarefa', path: `${ws}/t/${customId}` },
    { slug: 'configuracoes', path: `${ws}/configuracoes/perfil` },
  ];

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
});

test.afterAll(async () => {
  await page.context().close();
  await session.api.delete(`${API_URL}/workspaces/${wsId}/spaces/${spaceId}`, {
    headers: session.headers,
  });
  await session.dispose();
});

test('axe sem violação séria ou crítica nas rotas principais', async () => {
  test.setTimeout(8 * 60_000);

  const failures: string[] = [];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.locator('#conteudo')).toBeVisible();
    await page.waitForTimeout(600);

    for (const violation of await blockingViolations(page)) {
      failures.push(`${route.slug}: ${violation}`);
    }
  }

  expect(failures, failures.join('\n')).toEqual([]);
});

test('axe nas telas de acesso', async ({ page: anonymous }) => {
  for (const path of ['/login', '/cadastro']) {
    await anonymous.goto(path);
    await expect(
      anonymous.getByRole('button', { name: /Entrar|Criar conta/ }).first(),
    ).toBeVisible();

    const failures = await blockingViolations(anonymous);

    expect(failures, failures.join('\n')).toEqual([]);
  }
});

test('o teclado chega ao conteúdo, à navegação e volta', async () => {
  await page.goto(`/w/${wsId}`);
  await expect(page.locator('#conteudo')).toBeVisible();

  // O primeiro Tab da página cai no atalho "Pular para o conteúdo".
  await page.locator('body').press('Tab');

  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });

  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page.locator('#conteudo')).toBeFocused();

  // A partir do conteúdo, o Tab segue entrando nos controles da tela.
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveCount(1);

  const focusable = await page.evaluate(
    () =>
      document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ).length,
  );

  expect(focusable, 'controles alcançáveis por teclado').toBeGreaterThan(10);
});

test('o menu do celular abre e fecha pelo teclado', async () => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`/w/${wsId}`);

  const menu = page.getByRole('button', { name: 'Abrir navegação' });

  await expect(menu).toBeVisible();
  await menu.press('Enter');

  const drawer = page.getByRole('dialog', { name: 'Navegação do workspace' });

  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 900 });
});

test('prefers-reduced-motion zera as animações', async ({ browser }) => {
  // Sem sessão: /login é a tela com animação de entrada (.auth-rise).
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const quiet = await context.newPage();

  await quiet.goto('/login');
  await expect(quiet.getByRole('button', { name: 'Entrar' })).toBeVisible();

  const animation = await quiet.evaluate(() => {
    const panel = document.querySelector('.auth-rise');

    return panel ? getComputedStyle(panel).animationDuration : 'sem painel';
  });

  // O navegador imprime o valor como 1e-05s; o que importa é ser quase zero.
  expect(Number.parseFloat(animation)).toBeLessThan(0.01);
  await context.close();
});
