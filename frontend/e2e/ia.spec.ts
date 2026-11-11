import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** A IA vai mockada na rede: o teste cobre a tela, não o provedor. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F15 IA ${stamp}`;
const LIST = `Pendências ${stamp}`;
const TASK = `Fechar o caixa ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId = '';
let listId = '';
let taskId = '';
let taskCustomId = '';

interface StatusBody {
  id: string;
  group: string;
}

interface TaskBody {
  id: string;
  customId: string;
}

function sseBody(): string {
  const events = [
    { type: 'start', conversationId: '6500000000000000000000f1' },
    {
      type: 'tool',
      name: 'list_overdue',
      result: { items: [{ id: taskId, customId: taskCustomId, name: TASK }] },
    },
    { type: 'delta', text: 'Você tem ' },
    { type: 'delta', text: '**1 tarefa** atrasada.' },
    { type: 'done', conversationId: '6500000000000000000000f1', model: 'stub' },
  ];

  return `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n\n')}\n\n`;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', { name: SPACE });

  listId = await createResource(session, 'lists', { spaceId, name: LIST });

  const statuses = await session.api.get(`${API_URL}/workspaces/${wsId}/lists/${listId}/statuses`, {
    headers: session.headers,
  });
  const effective = (await statuses.json()) as { statuses: StatusBody[] };
  const open = effective.statuses.find((status) => status.group === 'notStarted');

  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name: TASK, statusId: open?.id },
  });

  expect(created.ok(), 'tarefa do cenário').toBeTruthy();

  const task = (await created.json()) as TaskBody;

  taskId = task.id;
  taskCustomId = task.customId;

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();

  await page.route('**/ai/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: sseBody(),
    }),
  );

  await page.route('**/ai/summarize', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entityType: 'task',
        id: taskId,
        summary: '## Onde está\n\nA tarefa segue em andamento e vence hoje.',
      }),
    }),
  );

  await page.route('**/ai/tasks-from-text/confirm', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ listId, created: [{ id: taskId, customId: taskCustomId }] }),
    }),
  );

  await page.route('**/ai/tasks-from-text', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        listId,
        tasks: [{ name: 'Revisar o relatório' }, { name: 'Falar com o cliente' }],
        warnings: [],
      }),
    }),
  );
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('a conversa responde em streaming, com markdown e chip da tarefa', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/ia`);

  await expect(
    page.getByRole('heading', { name: 'Como posso ajudar no trabalho de hoje?' }),
  ).toBeVisible();

  await page.getByLabel('Pergunte à IA').fill('O que está atrasado?');
  await page.getByRole('button', { name: 'Enviar' }).click();

  await expect(page.getByText('atrasada.')).toBeVisible();
  await expect(page.locator('strong', { hasText: '1 tarefa' })).toBeVisible();

  const chip = page.getByRole('list', { name: 'Tarefas citadas' }).getByRole('link');

  await expect(chip).toContainText(taskCustomId);

  // A conversa entra no histórico e a conversa nova volta à tela vazia.
  await expect(
    page.getByRole('button', { name: 'O que está atrasado?', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(
    page.getByRole('heading', { name: 'Como posso ajudar no trabalho de hoje?' }),
  ).toBeVisible();

  await chip.click();
  await expect(page).toHaveURL(new RegExp(`/t/${taskCustomId}$`));
});

test('o botão Resumir mostra o resumo da tarefa', async () => {
  await page.goto(`/w/${wsId}/t/${taskCustomId}`);

  await page.getByRole('button', { name: 'Resumir com IA' }).first().click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('Resumo da tarefa')).toBeVisible();
  await expect(dialog.getByText('A tarefa segue em andamento e vence hoje.')).toBeVisible();
});

test('criar tarefas a partir de texto confirma a lista editada', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/ia`);

  await page.getByRole('button', { name: 'Texto em tarefas' }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('List de destino').selectOption(listId);
  await dialog.getByLabel('Texto').fill('Revisar o relatório e falar com o cliente até sexta.');
  await dialog.getByRole('button', { name: 'Propor tarefas' }).click();

  const first = dialog.getByLabel('Tarefa 1');

  await expect(first).toHaveValue('Revisar o relatório');
  await first.fill('Revisar o relatório do mês');
  await dialog.getByRole('button', { name: 'Remover Falar com o cliente' }).click();

  const confirm = page.waitForRequest(
    (request) =>
      request.url().includes('/ai/tasks-from-text/confirm') && request.method() === 'POST',
  );

  await dialog.getByRole('button', { name: /^Criar 1 tarefa/ }).click();

  const body = (await confirm).postDataJSON() as { tasks: { name: string }[] };

  expect(body.tasks).toHaveLength(1);
  expect(body.tasks[0]?.name).toBe('Revisar o relatório do mês');
});

test('a gaveta de IA abre pela topbar em qualquer tela', async () => {
  await page.goto(`/w/${wsId}/minhas-tarefas`);

  await page.getByRole('button', { name: 'Abrir IA' }).click();

  const drawer = page.getByRole('dialog');

  await expect(drawer.getByLabel('Pergunte à IA')).toBeVisible();
});

test('a tela da IA não rola para os lados em 360, 768 e 1280', async () => {
  await page.goto(`/w/${wsId}/ia`);
  await expect(page.getByLabel('Pergunte à IA')).toBeVisible();

  await expectNoHorizontalScroll(page);
});
