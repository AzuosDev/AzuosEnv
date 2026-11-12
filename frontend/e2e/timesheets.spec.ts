import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e um Space próprio: os lançamentos do seed ficam intocados. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F11 Horas ${stamp}`;
const LIST = `Semana ${stamp}`;
const TASK = `Lançar horas ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let adminName: string;

/** Horas de um rótulo em pt-BR ("2,5 h") como número. */
function hoursOf(text: string): number {
  return Number(text.replace(' h', '').replace(',', '.')) || 0;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', { name: SPACE });

  const listId = await createResource(session, 'lists', { spaceId, name: LIST });

  await createResource(session, `lists/${listId}/tasks`, { name: TASK });

  const me = await session.api.get(`${API_URL}/auth/me`, { headers: session.headers });

  expect(me.ok(), 'conta do seed').toBeTruthy();

  adminName = ((await me.json()) as { name: string }).name;

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('lança horas na grade da semana e vê o total', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/timesheets`);

  await expect(page.getByRole('heading', { level: 1, name: 'Timesheets' })).toBeVisible();

  const total = page.getByTestId('week-total');
  const before = hoursOf((await total.textContent()) ?? '');

  await page.getByRole('button', { name: 'Adicionar linha' }).click();
  await page.getByLabel('Buscar tarefa para lançar horas').fill(TASK.slice(0, 12));
  await page.getByRole('button', { name: new RegExp(TASK) }).click();

  const cell = page.getByLabel(new RegExp(`^Horas em .+: ${TASK}$`)).first();

  await expect(cell).toBeVisible();
  await cell.fill('2,5');
  await cell.blur();

  const row = page.getByRole('row').filter({ hasText: TASK });

  await expect(row.getByRole('cell').last()).toHaveText('2,5 h');
  await expect
    .poll(async () => hoursOf((await total.textContent()) ?? ''))
    .toBeCloseTo(before + 2.5, 1);
});

test('envia a semana e aprova como admin', async () => {
  await page.getByRole('button', { name: 'Enviar para aprovação' }).click();

  await expect(page.getByText('Enviada · aguardando aprovação')).toBeVisible();

  await page.getByRole('tab', { name: 'Aprovações' }).click();

  const week = page.getByRole('listitem').filter({ hasText: adminName }).first();

  await expect(week).toBeVisible();
  await week.getByRole('button', { name: 'Aprovar' }).click();

  await expect(page.getByText('Semana aprovada.')).toBeVisible();
});

test('a aba Equipe mostra a semana de cada pessoa', async () => {
  await page.getByRole('tab', { name: 'Equipe' }).click();

  await expect(page.getByRole('table', { name: /Horas da equipe/ })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: adminName })).toBeVisible();
});

test('Timesheets sem rolagem horizontal e com um dia por vez no celular', async () => {
  await page.getByRole('tab', { name: 'Minhas horas' }).click();
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole('button', { name: 'Próximo dia' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});
