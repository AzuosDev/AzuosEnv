import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e um Space próprio: o Planner do seed fica intocado. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F14 Planner ${stamp}`;
const LIST = `Agenda ${stamp}`;
const TASK = `Bloco de duas horas ${stamp}`;
const EVENT = `Reunião F14 ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let spaceId = '';

interface StatusBody {
  id: string;
  group: string;
}

interface MeBody {
  id: string;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const me = await session.api.get(`${API_URL}/auth/me`, { headers: session.headers });

  expect(me.ok(), 'usuário do seed').toBeTruthy();

  const userId = ((await me.json()) as MeBody).id;

  spaceId = await createResource(session, 'spaces', { name: SPACE });

  const listId = await createResource(session, 'lists', { spaceId, name: LIST });
  const statuses = await session.api.get(`${API_URL}/workspaces/${wsId}/lists/${listId}/statuses`, {
    headers: session.headers,
  });

  expect(statuses.ok(), 'statuses da List').toBeTruthy();

  const effective = (await statuses.json()) as { statuses: StatusBody[] };
  const open = effective.statuses.find((status) => status.group === 'notStarted');

  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name: TASK, statusId: open?.id, assigneeIds: [userId], estimateMinutes: 120 },
  });

  expect(created.ok(), 'criação da tarefa do Planner').toBeTruthy();

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

test('agenda a tarefa no primeiro horário livre da semana', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/planner`);

  await expect(page.getByRole('heading', { level: 1, name: 'Planner' })).toBeVisible();

  const backlog = page.getByRole('region', { name: 'Tarefas para agendar' });
  const card = backlog.getByRole('listitem').filter({ hasText: TASK });

  await expect(card).toBeVisible();
  await expect(card.getByText('2h')).toBeVisible();

  await card.getByRole('button', { name: 'Agendar' }).click();

  // O bloco entra na grade com o nome da tarefa e sai da lista de pendentes.
  await expect(page.getByRole('button', { name: new RegExp(TASK) }).first()).toBeVisible();
  await expect(backlog.getByRole('listitem').filter({ hasText: TASK })).toHaveCount(0);

  const selected = page.getByRole('region', { name: 'Bloco selecionado' });

  await expect(selected.getByText(TASK)).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: new RegExp(TASK) }).first()).toBeVisible();
});

test('cria um evento e o remove do calendário', async () => {
  await page.getByRole('button', { name: 'Novo evento' }).click();
  await page.getByLabel('Título').fill(EVENT);
  await page.getByRole('textbox', { name: 'Início' }).fill('15:00');
  await page.getByRole('textbox', { name: 'Fim' }).fill('16:00');
  await page.getByRole('button', { name: 'Criar evento' }).click();

  const block = page.getByRole('button', { name: new RegExp(EVENT) }).first();

  await expect(block).toBeVisible();

  await block.click();

  const selected = page.getByRole('region', { name: 'Bloco selecionado' });

  await expect(selected.getByText(EVENT)).toBeVisible();
  await selected.getByRole('button', { name: 'Excluir evento' }).click();

  await expect(page.getByRole('button', { name: new RegExp(EVENT) })).toHaveCount(0);
});

test('o Google Agenda leva para Integrações e os recortes trocam', async () => {
  const connect = page.getByRole('link', { name: 'Conectar Google Agenda' });

  await expect(connect).toBeVisible();
  await expect(connect).toHaveAttribute('href', /\/configuracoes\/integracoes$/);

  const modes = page.getByRole('group', { name: 'Recorte do Planner' });

  await modes.getByRole('button', { name: 'Mês' }).click();
  await expect(modes.getByRole('button', { name: 'Mês' })).toHaveAttribute('aria-pressed', 'true');

  await modes.getByRole('button', { name: 'Dia' }).click();
  await expect(page.getByRole('button', { name: 'Próximo período' })).toBeVisible();

  await modes.getByRole('button', { name: 'Semana' }).click();
});

test('o Planner cabe em 360, 768 e 1280', async () => {
  await page.goto(`/w/${wsId}/planner`);

  await expect(page.getByRole('heading', { level: 1, name: 'Planner' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Abaixo de 1024 o recorte é sempre o dia e a grade não oferece os modos.
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole('group', { name: 'Recorte do Planner' })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
