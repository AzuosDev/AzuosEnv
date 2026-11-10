import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e um Space próprio por execução. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F11 Auto ${stamp}`;
const LIST = `Revisao ${stamp}`;
const RULE = `Code review vira revisao ${stamp}`;
const TEMPLATE = `Template ${stamp}`;
const APPLIED = `Aplicada ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let spaceId: string;
let listId: string;
let reviewStatus: { id: string; name: string };
let adminName: string;

interface StatusBody {
  id: string;
  name: string;
  group: string;
}

interface TaskBody {
  id: string;
  customId: string;
  assigneeIds: string[];
}

async function readTask(id: string): Promise<TaskBody> {
  const response = await session.api.get(`${API_URL}/workspaces/${wsId}/tasks/${id}`, {
    headers: session.headers,
  });

  expect(response.ok(), 'leitura da tarefa').toBeTruthy();

  return (await response.json()) as TaskBody;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;
  spaceId = await createResource(session, 'spaces', { name: SPACE, statusTemplate: 'dev' });
  listId = await createResource(session, 'lists', { spaceId, name: LIST });

  const statuses = await session.api.get(`${API_URL}/workspaces/${wsId}/lists/${listId}/statuses`, {
    headers: session.headers,
  });

  expect(statuses.ok(), 'statuses da List').toBeTruthy();

  const effective = (await statuses.json()) as { statuses: StatusBody[] };
  const chosen = effective.statuses.find((status) => status.group === 'active');

  expect(chosen, 'status ativo da List').toBeTruthy();
  reviewStatus = { id: chosen?.id ?? '', name: chosen?.name ?? '' };

  const me = await session.api.get(`${API_URL}/auth/me`, { headers: session.headers });

  expect(me.ok(), 'conta do seed').toBeTruthy();
  adminName = ((await me.json()) as { name: string }).name;

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.api.delete(`${API_URL}/workspaces/${wsId}/spaces/${spaceId}`, {
    headers: session.headers,
  });
  await session.dispose();
});

test('a receita abre o construtor e a automação nasce ativa', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/automacoes`);

  await expect(page.getByRole('heading', { level: 1, name: 'Automações' })).toBeVisible();

  await page.getByRole('button', { name: 'Ao mudar status, atribuir revisor' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: /atribuir revisor/ })).toBeVisible();
  await dialog.getByLabel('Nome').fill(RULE);
  await dialog.getByLabel('Onde').selectOption(`list:${listId}`);
  await dialog.getByLabel('Status de destino').selectOption(reviewStatus.id);
  await dialog.getByRole('checkbox', { name: adminName }).first().check();
  await dialog.getByRole('button', { name: 'Salvar e ativar' }).click();

  const row = page.getByRole('listitem').filter({ hasText: RULE });

  await expect(row).toContainText('QUANDO');
  await expect(row).toContainText('ENTÃO');
  await expect(row).toContainText('Ativa');
});

test('a automação roda: mudar o status atribui o revisor', async () => {
  const created = await createResource(session, `lists/${listId}/tasks`, {
    name: `Tarefa da regra ${stamp}`,
  });

  const changed = await session.api.patch(`${API_URL}/workspaces/${wsId}/tasks/${created}`, {
    headers: session.headers,
    data: { statusId: reviewStatus.id },
  });

  expect(changed.ok(), 'mudança de status da tarefa').toBeTruthy();

  await expect
    .poll(async () => (await readTask(created)).assigneeIds.length, { timeout: 15_000 })
    .toBeGreaterThan(0);

  await page.getByRole('tab', { name: 'Histórico' }).click();
  await page.getByLabel('Automação').selectOption({ label: RULE });

  await expect(page.getByRole('cell', { name: 'Executada' }).first()).toBeVisible();
});

test('desliga e religa a automação', async () => {
  await page.getByRole('tab', { name: 'Regras' }).click();

  const row = page.getByRole('listitem').filter({ hasText: RULE });

  await row.getByRole('switch', { name: `Ligar ${RULE}` }).click();
  await expect(row).toContainText('Desligada');

  await row.getByRole('switch', { name: `Ligar ${RULE}` }).click();
  await expect(row).toContainText('Ativa');
});

test('salva a List como template e aplica no Space', async () => {
  await page.goto(`/w/${wsId}/l/${listId}`);
  await page
    .getByRole('button', { name: `Ações de ${LIST}` })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Salvar como template' }).click();

  const saving = page.getByRole('dialog');

  await saving.getByLabel('Nome do template').fill(TEMPLATE);
  await saving.getByRole('button', { name: 'Salvar template' }).click();

  await page.goto(`/w/${wsId}/automacoes`);
  await page.getByRole('tab', { name: 'Templates' }).click();

  const entry = page.getByRole('listitem').filter({ hasText: TEMPLATE });

  await expect(entry).toBeVisible();
  await entry.getByRole('button', { name: 'Aplicar' }).click();

  const applying = page.getByRole('dialog');

  await applying.getByLabel('Nome').fill(APPLIED);
  await applying.getByLabel('Destino').selectOption(`space:${spaceId}`);
  await applying.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page.getByText('Template aplicado.')).toBeVisible();
  await expect(page.getByRole('link', { name: APPLIED })).toBeVisible();
});

test('Automações sem rolagem horizontal', async () => {
  await page.getByRole('tab', { name: 'Regras' }).click();
  await expectNoHorizontalScroll(page);
});
