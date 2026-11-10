import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e um Space próprio: os dashboards do seed ficam intocados. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F11 Painel ${stamp}`;
const LIST = `Entrega ${stamp}`;
const DASHBOARD = `Painel ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let listId: string;
let open: StatusBody | undefined;

interface StatusBody {
  id: string;
  name: string;
  group: string;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', { name: SPACE });

  listId = await createResource(session, 'lists', { spaceId, name: LIST });

  const statuses = await session.api.get(`${API_URL}/workspaces/${wsId}/lists/${listId}/statuses`, {
    headers: session.headers,
  });

  expect(statuses.ok(), 'statuses da List').toBeTruthy();

  const effective = (await statuses.json()) as { statuses: StatusBody[] };

  open = effective.statuses.find((status) => status.group === 'notStarted');

  expect(open, 'status inicial da List').toBeTruthy();

  for (const name of ['Primeira', 'Segunda', 'Terceira']) {
    await createResource(session, `lists/${listId}/tasks`, {
      name: `${name} ${stamp}`,
      statusId: open?.id,
    });
  }

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('cria o dashboard pelo hub e ele abre vazio', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/dashboards`);

  await expect(page.getByRole('heading', { level: 1, name: 'Dashboards' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo dashboard' }).click();
  await page.getByLabel('Nome').fill(DASHBOARD);
  await page.getByRole('button', { name: 'Criar dashboard' }).click();

  await expect(page.getByRole('link', { name: DASHBOARD, exact: true })).toBeVisible();

  await page.getByRole('link', { name: DASHBOARD, exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: DASHBOARD })).toBeVisible();
  await expect(page.getByText('Nenhum card ainda')).toBeVisible();
});

test('adiciona o card por status e confere os números', async () => {
  await page.getByRole('button', { name: 'Card', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('tasksByStatus');
  await page.getByLabel('Local').selectOption(`list:${listId}`);
  await page.getByRole('button', { name: 'Adicionar card' }).click();

  const card = page.getByRole('region', { name: 'Tarefas por status' });

  await expect(card).toBeVisible();

  const row = card.getByRole('listitem').filter({ hasText: open?.name ?? '' });

  await expect(row).toContainText('3');
});

test('o card privado some para outra pessoa e o compartilhado aparece', async () => {
  await page.goto(`/w/${wsId}/dashboards`);

  const row = page.getByRole('listitem').filter({ hasText: DASHBOARD });

  await row.getByRole('button', { name: `Ações de ${DASHBOARD}` }).click();
  await page.getByRole('menuitem', { name: 'Tornar privado' }).click();

  await expect(row.getByText('Privado')).toBeVisible();

  await row.getByRole('button', { name: `Ações de ${DASHBOARD}` }).click();
  await page.getByRole('menuitem', { name: 'Compartilhar com o workspace' }).click();

  await expect(row.getByText('Privado')).toHaveCount(0);
});

test('Dashboards sem rolagem horizontal e em uma coluna no celular', async () => {
  await page.getByRole('link', { name: DASHBOARD, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Tarefas por status' })).toBeVisible();

  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole('region', { name: 'Tarefas por status' })).toBeVisible();
  await expect(page.locator('.react-grid-layout')).toHaveCount(0);
});
