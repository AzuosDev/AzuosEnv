import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só; a meta do seed (Metas 2026) fica intocada. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F14 Metas ${stamp}`;
const LIST = `Entregas ${stamp}`;
const FOLDER = `Metas do trimestre ${stamp}`;
const GOAL = `Entregar o módulo ${stamp}`;
const TARGET = `Tarefas entregues ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let spaceId = '';
let openTaskId = '';
let doneStatusId = '';

interface StatusBody {
  id: string;
  group: string;
}

interface TaskBody {
  id: string;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;
  spaceId = await createResource(session, 'spaces', { name: SPACE });

  const listId = await createResource(session, 'lists', { spaceId, name: LIST });
  const statuses = await session.api.get(`${API_URL}/workspaces/${wsId}/lists/${listId}/statuses`, {
    headers: session.headers,
  });

  expect(statuses.ok(), 'statuses da List').toBeTruthy();

  const effective = (await statuses.json()) as { statuses: StatusBody[] };
  const open = effective.statuses.find((status) => status.group === 'notStarted');
  const done = effective.statuses.find((status) => status.group === 'done');

  expect(done, 'status de concluído da List').toBeTruthy();

  doneStatusId = done?.id ?? '';

  for (const [index, statusId] of [open?.id, done?.id].entries()) {
    const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
      headers: session.headers,
      data: { name: `Tarefa ${String(index + 1)} ${stamp}`, statusId },
    });

    expect(created.ok(), 'criação da tarefa da meta').toBeTruthy();

    if (index === 0) {
      openTaskId = ((await created.json()) as TaskBody).id;
    }
  }

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

test('cria a pasta e a meta pelo hub', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/metas`);

  await expect(page.getByRole('heading', { level: 1, name: 'Metas' })).toBeVisible();

  await page.getByRole('button', { name: 'Nova pasta' }).click();
  await page.getByLabel('Nome').fill(FOLDER);
  await page.getByRole('button', { name: 'Criar pasta' }).click();

  await expect(page.getByRole('button', { name: FOLDER })).toBeVisible();

  await page.getByRole('button', { name: 'Nova meta' }).first().click();
  await page.getByLabel('Nome').fill(GOAL);
  await page.getByLabel('Pasta', { exact: true }).selectOption({ label: FOLDER });
  await page.getByRole('button', { name: 'Criar meta' }).click();

  await expect(page.getByRole('link', { name: GOAL })).toBeVisible();
});

test('o alvo de tarefas sai de 50% e chega a 100% quando a tarefa fecha', async () => {
  await page.getByRole('link', { name: GOAL }).click();

  await expect(page.getByRole('heading', { level: 1, name: GOAL })).toBeVisible();

  await page.getByRole('button', { name: 'Novo alvo' }).click();
  await page.getByLabel('Nome').fill(TARGET);
  await page.getByLabel('Tipo').selectOption('tasks');
  await page.getByLabel('List acompanhada').selectOption({ label: LIST });
  await page.getByRole('button', { name: 'Criar alvo' }).click();

  const targets = page.getByRole('region', { name: 'Alvos da meta' });

  // Duas tarefas na List, uma concluída: metade do alvo.
  await expect(targets.getByText('1 de 2 tarefas')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: `Progresso de ${GOAL}` })).toHaveAttribute(
    'aria-valuenow',
    '50',
  );

  // Concluir a tarefa que faltava dispara o evento que recalcula o alvo.
  const patched = await session.api.patch(`${API_URL}/workspaces/${wsId}/tasks/${openTaskId}`, {
    headers: session.headers,
    data: { statusId: doneStatusId },
  });

  expect(patched.ok(), 'conclusão da tarefa pela API').toBeTruthy();

  await page.reload();

  await expect(targets.getByText('2 de 2 tarefas')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: `Progresso de ${GOAL}` })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
});

test('o alvo de número anda pelo +/- e pelo campo', async () => {
  await page.getByRole('button', { name: 'Novo alvo' }).click();
  await page.getByLabel('Nome').fill(`Horas ${stamp}`);
  await page.getByLabel('Tipo').selectOption('number');
  await page.getByRole('textbox', { name: 'Começo' }).fill('0');
  await page.getByRole('textbox', { name: 'Alvo', exact: true }).fill('10');
  await page.getByLabel('Unidade').fill('horas');
  await page.getByRole('button', { name: 'Criar alvo' }).click();

  const value = page.getByLabel(`Valor de Horas ${stamp}`);

  await expect(value).toHaveValue('0');

  await page.getByRole('button', { name: `Aumentar Horas ${stamp}` }).click();
  await expect(value).toHaveValue('1');

  await value.fill('5');
  await value.press('Enter');

  await expect(page.getByText('5 de 10 horas')).toBeVisible();

  await page.reload();
  await expect(page.getByText('5 de 10 horas')).toBeVisible();
});

test('o hub e o detalhe cabem em 360, 768 e 1280', async () => {
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/metas`);

  await expect(page.getByRole('link', { name: GOAL })).toBeVisible();

  const card = page.getByRole('region', { name: FOLDER });

  await card.getByRole('button', { name: /Alvos \(/ }).click();
  await expect(card.getByText('2 de 2 tarefas')).toBeVisible();

  await expectNoHorizontalScroll(page);
});
