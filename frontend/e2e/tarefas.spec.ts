import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
  type Credentials,
} from './helpers';

/**
 * Uma sessão só para o arquivo e uma List própria por execução: as tarefas do
 * seed continuam intocadas para os outros specs.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F6 Tarefas ${stamp}`;
const LIST = `Sprint ${stamp}`;
const TASK_A = `Ajustar caixa ${stamp}`;
const TASK_B = `Integrar TEF ${stamp}`;
const TASK_C = `Relatório ${stamp}`;
const PRIVATE_VIEW = `Privada ${stamp}`;
const MEMBER = `member-f6-${stamp}`;

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  statusId: string;
  priority: string | null;
}

interface StatusBody {
  id: string;
  name: string;
  group: string;
}

let page: Page;
let session: AdminApi;
let wsId: string;
let listId: string;
let statuses: StatusBody[];
let tasks: Record<string, TaskBody>;
let member: Credentials;

async function createTask(name: string, statusId?: string): Promise<TaskBody> {
  const response = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name, ...(statusId ? { statusId } : {}) },
  });

  expect(response.ok(), `criação da tarefa ${name}`).toBeTruthy();

  return (await response.json()) as TaskBody;
}

async function readTask(customId: string): Promise<TaskBody> {
  const response = await session.api.get(`${API_URL}/workspaces/${wsId}/tasks/${customId}`, {
    headers: session.headers,
  });

  expect(response.ok(), `leitura da tarefa ${customId}`).toBeTruthy();

  return (await response.json()) as TaskBody;
}

function statusId(name: string): string {
  const status = statuses.find((item) => item.name === name);

  expect(status, `status ${name}`).toBeTruthy();

  return status?.id ?? '';
}

async function openList(page_: Page, view: 'Lista' | 'Quadro' = 'Lista'): Promise<void> {
  await page_.goto(`/w/${wsId}/l/${listId}`);
  await expect(page_.getByRole('heading', { level: 1, name: LIST })).toBeVisible();

  if (view !== 'Lista') {
    await page_.getByRole('button', { name: new RegExp(`^${view}`) }).click();
  }

  await expect(page_.getByRole('link', { name: TASK_A })).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', {
    name: SPACE,
    statusTemplate: 'simples',
  });

  listId = await createResource(session, 'lists', { spaceId, name: LIST });

  const effective = await session.api.get(
    `${API_URL}/workspaces/${wsId}/lists/${listId}/statuses`,
    { headers: session.headers },
  );

  expect(effective.ok(), 'statuses da List').toBeTruthy();
  statuses = ((await effective.json()) as { statuses: StatusBody[] }).statuses;

  tasks = {
    a: await createTask(TASK_A),
    b: await createTask(TASK_B),
    c: await createTask(TASK_C, statusId('Em andamento')),
  };

  member = await createWorkspaceMember(MEMBER, 'member');

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test.beforeEach(async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('a Lista agrupa por status e cria tarefa pelo grupo', async () => {
  await openList(page);

  await expect(page.getByRole('button', { name: /Recolher grupo/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: TASK_C })).toBeVisible();

  const name = `Nova pelo grupo ${stamp}`;

  await page.getByRole('button', { name: '+ Adicionar tarefa' }).first().click();
  await page.getByPlaceholder('Nome da tarefa e Enter').fill(name);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('link', { name })).toBeVisible();
});

test('muda o status pelo popover da linha', async () => {
  await openList(page);

  await page.getByRole('button', { name: new RegExp(`^Status de ${TASK_A}:`) }).click();
  await page.getByRole('button', { name: 'Em andamento', exact: true }).click();

  await expect(
    page.getByRole('button', { name: `Status de ${TASK_A}: Em andamento` }),
  ).toBeVisible();

  await expect
    .poll(async () => (await readTask(tasks.a?.customId ?? '')).statusId, { timeout: 10_000 })
    .toBe(statusId('Em andamento'));
});

test('ação em massa muda a prioridade das tarefas marcadas', async () => {
  await openList(page);

  await page.getByRole('checkbox', { name: `Selecionar ${TASK_B}` }).click();
  await page.getByRole('checkbox', { name: `Selecionar ${TASK_C}` }).click();

  await expect(page.getByText('2 tarefas selecionadas')).toBeVisible();

  await page.getByRole('button', { name: 'Prioridade', exact: true }).click();
  await page.getByRole('button', { name: 'Urgente' }).click();

  for (const key of ['b', 'c'] as const) {
    await expect
      .poll(async () => (await readTask(tasks[key]?.customId ?? '')).priority, {
        timeout: 10_000,
      })
      .toBe('urgent');
  }
});

test('arrastar o card no Quadro muda o status', async () => {
  await openList(page, 'Quadro');

  const handle = page.getByRole('button', { name: `Arrastar ${TASK_B}` });
  const column = page.getByRole('region', { name: 'Concluído' });

  await handle.scrollIntoViewIfNeeded();

  const from = await handle.boundingBox();
  const to = await column.boundingBox();

  expect(from, 'alça do card').toBeTruthy();
  expect(to, 'coluna de destino').toBeTruthy();

  if (!from || !to) {
    return;
  }

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const dropY = to.y + Math.min(60, to.height / 2);

  await page.mouse.move(to.x + to.width / 2, dropY, { steps: 15 });
  await page.mouse.move(to.x + to.width / 2, dropY + 4, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () => (await readTask(tasks.b?.customId ?? '')).statusId, { timeout: 15_000 })
    .toBe(statusId('Concluído'));
});

test('view privada não aparece para outra pessoa', async ({ browser }) => {
  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/views`, {
    headers: session.headers,
    data: {
      locationType: 'list',
      locationId: listId,
      type: 'list',
      name: PRIVATE_VIEW,
      private: true,
    },
  });

  expect(created.ok(), 'criação da view privada').toBeTruthy();

  await openList(page);
  await expect(page.getByRole('button', { name: new RegExp(`^${PRIVATE_VIEW}`) })).toBeVisible();

  const context = await browser.newContext();

  await signInContext(context, member);

  const otherPage = await context.newPage();

  await otherPage.goto(`/w/${wsId}/l/${listId}`);
  await expect(otherPage.getByRole('heading', { level: 1, name: LIST })).toBeVisible();
  await expect(otherPage.getByRole('button', { name: /^Lista/ })).toBeVisible();
  await expect(otherPage.getByRole('button', { name: new RegExp(`^${PRIVATE_VIEW}`) })).toHaveCount(
    0,
  );

  await context.close();
});

test('Lista e Quadro sem rolagem horizontal em 360, 768 e 1280', async () => {
  await openList(page);
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await openList(page, 'Quadro');
  await page.setViewportSize({ width: 360, height: 900 });
  await expectNoHorizontalScroll(page);
});
