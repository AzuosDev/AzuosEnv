import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e um Space próprio para as sprints. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F14 Sprints ${stamp}`;
const FOLDER = `Sprints ${stamp}`;
const TASK = `Pendência da sprint ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let spaceId = '';
let sprintId = '';

interface StatusBody {
  id: string;
  group: string;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;
  spaceId = await createResource(session, 'spaces', { name: SPACE });

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

test('cria a pasta de sprints pelo menu do Space', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/s/${spaceId}`);

  await expect(page.getByRole('heading', { level: 1, name: SPACE })).toBeVisible();

  await page
    .getByRole('button', { name: `Ações de ${SPACE}` })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Nova pasta de sprints' }).click();

  await page.getByLabel('Nome').fill(FOLDER);
  await page.getByLabel('Duração de cada sprint').selectOption('14');
  await page.getByRole('button', { name: 'Criar pasta de sprints' }).click();

  // A primeira sprint é uma List e o app abre nela.
  await page.waitForURL(/\/l\/[0-9a-f]{24}/);

  const strip = page.getByRole('region', { name: /^Sprint / });

  await expect(strip).toBeVisible();
  await expect(strip.getByText('Sprint atual')).toBeVisible();
  await expect(strip.getByText(FOLDER)).toBeVisible();

  sprintId = page.url().split('/l/')[1] ?? '';

  expect(sprintId, 'id da primeira sprint').toHaveLength(24);
});

test('a sprint atual fica marcada na sidebar', async () => {
  const sidebar = page.getByRole('navigation', { name: 'Spaces' });
  const space = sidebar.getByRole('link', { name: SPACE });

  if (await space.isHidden()) {
    await sidebar.getByRole('button', { name: `Expandir ${SPACE}` }).click();
  }

  await expect(sidebar.getByText('Sprint').first()).toBeVisible();
});

test('fechar a sprint leva a pendência para a próxima', async () => {
  const statuses = await session.api.get(
    `${API_URL}/workspaces/${wsId}/lists/${sprintId}/statuses`,
    { headers: session.headers },
  );

  expect(statuses.ok(), 'statuses da sprint').toBeTruthy();

  const effective = (await statuses.json()) as { statuses: StatusBody[] };
  const open = effective.statuses.find((status) => status.group === 'notStarted');
  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${sprintId}/tasks`, {
    headers: session.headers,
    data: { name: TASK, statusId: open?.id, points: 5 },
  });

  expect(created.ok(), 'criação da pendência').toBeTruthy();

  await page.reload();

  const strip = page.getByRole('region', { name: /^Sprint / });

  await expect(strip.getByText('0 de 5 pontos')).toBeVisible();

  await strip.getByRole('button', { name: 'Fechar sprint' }).click();

  await expect(page.getByText('1 tarefa em aberto vai para a próxima sprint')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar sprint' }).last().click();

  await expect(page.getByText(/Sprint fechada: 1 tarefa foi para/)).toBeVisible();

  // A sprint fechada não tem mais a pendência e passa a se mostrar como fechada.
  await page.reload();
  await expect(page.getByRole('region', { name: /^Sprint / }).getByText('Fechada')).toBeVisible();
  await expect(page.getByText(TASK)).toHaveCount(0);
});

test('a faixa da sprint cabe em 360, 768 e 1280', async () => {
  await expect(page.getByRole('region', { name: /^Sprint / })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
