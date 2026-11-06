import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/**
 * Uma sessão só para o arquivo e um Space próprio por execução: as views do
 * seed continuam intocadas para os outros specs.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F9 Views ${stamp}`;
const LIST = `Entrega ${stamp}`;
const CAL = `Calendario ${stamp}`;
const TAB = `Tabela ${stamp}`;
const GAN = `Gantt ${stamp}`;
const WRK = `Workload ${stamp}`;
const SEM = `Sem data ${stamp}`;
const MEMBER = `member-f9-${stamp}`;

type ViewName =
  'Lista' | 'Calendário' | 'Tabela' | 'Gantt' | 'Timeline' | 'Workload' | 'Team' | 'Activity';

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  statusId: string;
  startAt: string | null;
  dueAt: string | null;
  assigneeIds: string[];
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
let adminId: string;
let adminName: string;
let memberName: string;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Dia local no formato yyyy-MM-dd, com deslocamento em dias. */
function dayKey(offset: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offset);

  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Meio-dia local do dia, que é a hora neutra que o app grava. */
function noon(offset: number): string {
  return new Date(`${dayKey(offset)}T12:00:00`).toISOString();
}

async function createTask(name: string, body: Record<string, unknown> = {}): Promise<TaskBody> {
  const response = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name, ...body },
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
  return statuses.find((item) => item.name === name)?.id ?? '';
}

async function createView(type: string, name: string): Promise<void> {
  const response = await session.api.post(`${API_URL}/workspaces/${wsId}/views`, {
    headers: session.headers,
    data: { locationType: 'list', locationId: listId, type, name },
  });

  expect(response.ok(), `criação da view ${name}`).toBeTruthy();
}

async function openView(name: ViewName): Promise<void> {
  if (!page.url().includes(`/l/${listId}`)) {
    await page.goto(`/w/${wsId}/l/${listId}`);
  }

  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

/** Arrasto por ponteiro, do centro de um elemento até um ponto do outro. */
async function dragTo(handle: Locator, target: Locator, offsetX = 0.5): Promise<void> {
  await handle.scrollIntoViewIfNeeded();

  const from = await handle.boundingBox();
  const to = await target.boundingBox();

  expect(from, 'origem do arrasto').toBeTruthy();
  expect(to, 'destino do arrasto').toBeTruthy();

  if (!from || !to) {
    return;
  }

  const x = to.x + to.width * offsetX;
  const y = to.y + Math.min(40, to.height / 2);

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 15 });
  await page.mouse.move(x, y + 3, { steps: 5 });
  await page.mouse.up();
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const me = await session.api.get(`${API_URL}/auth/me`, { headers: session.headers });

  expect(me.ok(), 'conta do seed').toBeTruthy();

  const profile = (await me.json()) as { id: string; name: string };

  adminId = profile.id;
  adminName = profile.name;

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
    cal: await createTask(CAL, { dueAt: noon(0) }),
    tab: await createTask(TAB, { dueAt: noon(1) }),
    gan: await createTask(GAN, { startAt: noon(0), dueAt: noon(3) }),
    wrk: await createTask(WRK, { dueAt: noon(0), assigneeIds: [adminId] }),
    sem: await createTask(SEM),
  };

  await createWorkspaceMember(MEMBER, 'member');
  memberName = `Pessoa ${MEMBER}`;

  await createView('calendar', 'Calendário');
  await createView('table', 'Tabela');
  await createView('gantt', 'Gantt');
  await createView('workload', 'Workload');
  await createView('team', 'Team');
  await createView('activity', 'Activity');

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

test('"+ View" oferece todos os tipos e cria a Timeline', async () => {
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();

  await page.getByRole('button', { name: 'Adicionar view' }).click();

  for (const label of [
    'Calendário',
    'Tabela',
    'Gantt',
    'Timeline',
    'Workload',
    'Team',
    'Activity',
  ]) {
    await expect(page.getByRole('menuitem', { name: label })).toBeVisible();
  }

  await page.getByRole('menuitem', { name: 'Timeline' }).click();

  await expect(page.getByRole('button', { name: /^Timeline/ })).toBeVisible();
});

test('Calendário: arrastar a tarefa muda o prazo', async () => {
  await openView('Calendário');

  const chip = page.getByRole('button', { name: `Arrastar ${CAL}` });

  await expect(chip).toBeVisible();
  await expect(page.locator(`[data-day="${dayKey(0)}"]`)).toBeVisible();

  await dragTo(chip, page.locator(`[data-day="${dayKey(2)}"]`));

  await expect
    .poll(async () => (await readTask(tasks.cal?.customId ?? '')).dueAt, { timeout: 15_000 })
    .toBe(noon(2));
});

test('Calendário: tarefa sem data fica à parte e o dia cria tarefa', async () => {
  await openView('Calendário');

  const aside = page.getByRole('region', { name: 'Tarefas sem data' });

  await expect(aside.getByRole('link', { name: SEM })).toBeVisible();

  const name = `Pelo dia ${stamp}`;
  const day = dayKey(1);
  const cell = page.locator(`[data-day="${day}"]`);

  await cell.getByRole('button', { name: /^Nova tarefa em/ }).click();
  await cell.getByPlaceholder('Nome e Enter').fill(name);
  await page.keyboard.press('Enter');

  await expect(cell.getByRole('link', { name })).toBeVisible();
});

test('Tabela: editar o status na célula e esconder uma coluna', async () => {
  await openView('Tabela');

  const customId = tasks.tab?.customId ?? '';

  await page.getByRole('button', { name: new RegExp(`^Status de ${customId}:`) }).click();
  await page.getByRole('button', { name: 'Em andamento', exact: true }).click();

  await expect
    .poll(async () => (await readTask(customId)).statusId, { timeout: 15_000 })
    .toBe(statusId('Em andamento'));

  await expect(page.getByRole('columnheader', { name: /Tags/ })).toBeVisible();

  await page.getByRole('button', { name: 'Colunas' }).click();
  await page.getByRole('button', { name: 'Esconder a coluna Tags' }).click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('columnheader', { name: /Tags/ })).toHaveCount(0);
});

test('Gantt: arrastar a barra muda início e prazo', async () => {
  await openView('Gantt');

  const bar = page.getByRole('button', { name: new RegExp(`^Barra de ${GAN}:`) });

  await expect(bar).toBeVisible();
  await expect(page.getByRole('region', { name: 'Gráfico de Gantt' })).toBeVisible();

  const box = await bar.boundingBox();

  expect(box, 'barra do Gantt').toBeTruthy();

  if (!box) {
    return;
  }

  // Escala dia: 36 px por dia, então 72 px empurram a barra dois dias.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 72, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect
    .poll(async () => (await readTask(tasks.gan?.customId ?? '')).dueAt, { timeout: 15_000 })
    .toBe(noon(5));

  expect((await readTask(tasks.gan?.customId ?? '')).startAt).toBe(noon(2));
});

test('Workload: arrastar a tarefa entre pessoas reatribui', async () => {
  await openView('Workload');

  await expect(page.getByRole('region', { name: 'Carga por pessoa e dia' })).toBeVisible();

  const origin = page.getByRole('region', { name: `Tarefas de ${adminName}` });
  const target = page.getByRole('region', { name: `Tarefas de ${memberName}` });

  await expect(origin.getByRole('link', { name: WRK })).toBeVisible();

  await dragTo(origin.getByRole('button', { name: `Arrastar ${WRK}` }), target);

  await expect
    .poll(async () => (await readTask(tasks.wrk?.customId ?? '')).assigneeIds.join(','), {
      timeout: 15_000,
    })
    .not.toBe(adminId);
});

test('Team: cartão por pessoa com as contagens', async () => {
  await openView('Team');

  const card = page.getByRole('region', { name: `Tarefas de ${adminName}` });

  await expect(card).toBeVisible();
  await expect(card.getByText('Em andamento')).toBeVisible();
  await expect(card.getByText('Atrasadas')).toBeVisible();
  await expect(card.getByText('Concluídas')).toBeVisible();
});

test('Activity: feed do local com filtro', async () => {
  await openView('Activity');

  await expect(page.getByText(new RegExp(`criou a tarefa`)).first()).toBeVisible();

  await page.getByRole('button', { name: /^Filtrar/ }).click();
  await page.getByRole('checkbox', { name: 'Alteração' }).click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: /^Filtrar/ })).toContainText('1');
  await expect(page.getByText('criou a tarefa')).toHaveCount(0);
});

test('as views não rolam a página para os lados em 360, 768 e 1280', async () => {
  for (const name of [
    'Calendário',
    'Tabela',
    'Gantt',
    'Timeline',
    'Workload',
    'Team',
    'Activity',
  ] as const) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openView(name);
    await expectNoHorizontalScroll(page);
  }
});
