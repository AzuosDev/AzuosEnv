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
 * Uma sessão para o arquivo e um Space próprio por execução: o Inbox e a
 * lixeira do seed continuam intocados para os outros specs.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F10 Home ${stamp}`;
const LIST = `Caixa ${stamp}`;
const ASSIGNED = `Atribuir no outro navegador ${stamp}`;
const SNOOZED = `Adiar do principal ${stamp}`;
const FOUND = `Achar na palette ${stamp}`;
const TRASHED = `Restaurar da lixeira ${stamp}`;

interface TaskBody {
  id: string;
  customId: string;
  name: string;
}

let page: Page;
let session: AdminApi;
let wsId: string;
let listId: string;
let member: Credentials;
let memberId: string;
let assigned: TaskBody;
let snoozed: TaskBody;
let found: TaskBody;
let trashed: TaskBody;

async function createTask(name: string, data: Record<string, unknown> = {}): Promise<TaskBody> {
  const response = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name, ...data },
  });

  expect(response.ok(), `criação da tarefa ${name}`).toBeTruthy();

  return (await response.json()) as TaskBody;
}

/** Id do usuário da conta de apoio, para atribuir pela API. */
async function userIdOf(email: string): Promise<string> {
  const response = await session.api.get(`${API_URL}/workspaces/${wsId}/members`, {
    headers: session.headers,
  });

  expect(response.ok(), 'listagem de membros').toBeTruthy();

  const { items } = (await response.json()) as {
    items: { userId: { id: string; email: string } }[];
  };

  return items.find((item) => item.userId.email === email)?.userId.id ?? '';
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', {
    name: SPACE,
    statusTemplate: 'simples',
  });

  listId = await createResource(session, 'lists', { spaceId, name: LIST });
  member = await createWorkspaceMember(`f10-${stamp}`, 'member');
  memberId = await userIdOf(member.email);

  assigned = await createTask(ASSIGNED);
  found = await createTask(FOUND);
  trashed = await createTask(TRASHED);
  snoozed = await createTask(SNOOZED, { assigneeIds: [memberId] });

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('atribuir em um navegador cai no Inbox do outro com toast', async ({ browser }) => {
  const second = await browser.newContext();

  await signInContext(second, member);

  const other = await second.newPage();

  try {
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.goto(`/w/${wsId}/inbox`);
    await expect(other.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    // O admin abre a tarefa e põe a outra pessoa como responsável.
    await page.goto(`/w/${wsId}/t/${assigned.customId}`);
    await expect(page.getByLabel('Nome da tarefa')).toHaveValue(ASSIGNED, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Escolher responsáveis' }).click();
    await page.getByRole('button', { name: new RegExp(`Pessoa f10-${stamp}`) }).click();
    await page.keyboard.press('Escape');

    // O toast do notification.new chega antes de a lista ser refeita.
    await expect(other.getByText(`${assigned.customId}: atribuiu você a`).first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(
      other.getByRole('link', { name: new RegExp(assigned.customId) }).first(),
    ).toBeVisible({ timeout: 25_000 });
  } finally {
    await other.close();
    await second.close();
  }
});

test('adiar tira a notificação da aba Principal', async ({ browser }) => {
  const second = await browser.newContext();

  await signInContext(second, member);

  const other = await second.newPage();

  try {
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.goto(`/w/${wsId}/inbox`);

    const row = other
      .getByRole('listitem')
      .filter({ has: other.getByRole('link', { name: new RegExp(snoozed.customId) }) });

    await expect(row).toBeVisible({ timeout: 25_000 });

    await row.getByRole('button', { name: /^Ações da notificação de/ }).click();
    await other.getByRole('menuitem', { name: 'Adiar · Em 1 hora' }).click();

    await expect(row).toBeHidden({ timeout: 20_000 });

    await other.getByRole('tab', { name: /Mais tarde/ }).click();
    await expect(
      other.getByRole('link', { name: new RegExp(snoozed.customId) }).first(),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await other.close();
    await second.close();
  }
});

test('o Ctrl+K acha a tarefa pelo id e abre o painel dela', async () => {
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByRole('heading', { name: LIST, level: 1 })).toBeVisible({
    timeout: 20_000,
  });

  await page.keyboard.press('Control+k');

  const input = page.getByRole('combobox', { name: 'Termo da busca' });

  await expect(input).toBeVisible();
  await input.fill(found.customId);

  const option = page.getByRole('option', { name: new RegExp(FOUND) });

  await expect(option).toBeVisible({ timeout: 20_000 });
  await option.click();

  await expect(page).toHaveURL(new RegExp(`/t/${found.customId}$`), { timeout: 20_000 });
  await expect(page.getByLabel('Nome da tarefa')).toHaveValue(FOUND, { timeout: 20_000 });
});

test('a palette oferece as ações rápidas com o campo vazio', async () => {
  await page.goto(`/w/${wsId}`);
  // O atalho só existe depois de a topbar montar o listener.
  await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Control+k');

  await expect(page.getByRole('option', { name: 'Nova tarefa' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('option', { name: 'Alternar tema' })).toBeVisible();

  await page.getByRole('option', { name: 'Ir para Minhas tarefas' }).click();

  await expect(page).toHaveURL(/\/minhas-tarefas$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Minhas tarefas', level: 1 })).toBeVisible();
});

test('Minhas tarefas separa as seções por prazo', async () => {
  const mine = await createTask(`Hoje ${stamp}`, {
    assigneeIds: [await userIdOf('admin@azuos.dev')],
    dueAt: new Date().toISOString(),
  });

  await page.goto(`/w/${wsId}/minhas-tarefas`);
  await expect(page.getByRole('heading', { name: 'Minhas tarefas', level: 1 })).toBeVisible({
    timeout: 20_000,
  });

  await expect(page.getByRole('heading', { name: 'Hoje', level: 2 })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('link', { name: `Hoje ${stamp}` })).toBeVisible();
  expect(mine.customId).toMatch(/-\d+$/);
});

test('favoritar a List põe ela na sidebar e tirar a remove', async () => {
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByRole('heading', { name: LIST, level: 1 })).toBeVisible({
    timeout: 20_000,
  });

  await page
    .getByRole('button', { name: `Ações de ${LIST}` })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Favoritar' }).click();

  const favorites = page.getByRole('navigation', { name: 'Favoritos' });

  await expect(favorites.getByRole('link', { name: LIST })).toBeVisible({ timeout: 20_000 });

  await favorites.getByRole('button', { name: `Ações de ${LIST}` }).click();
  await page.getByRole('menuitem', { name: 'Tirar dos favoritos' }).click();

  await expect(favorites).toBeHidden({ timeout: 20_000 });
});

test('a tarefa da lixeira volta pelo Restaurar', async () => {
  const removed = await session.api.delete(`${API_URL}/workspaces/${wsId}/tasks/${trashed.id}`, {
    headers: session.headers,
  });

  expect(removed.ok(), 'exclusão da tarefa pela API').toBeTruthy();

  await page.goto(`/w/${wsId}/lixeira`);

  const row = page.getByRole('listitem').filter({ hasText: TRASHED });

  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole('button', { name: 'Restaurar' }).click();

  await expect(page.getByText(`“${TRASHED}” restaurado.`)).toBeVisible({ timeout: 20_000 });
  await expect(row).toBeHidden({ timeout: 20_000 });
});

test('a view Tudo mostra as tarefas do workspace', async () => {
  await page.goto(`/w/${wsId}/tudo`);

  await expect(page.getByRole('heading', { name: 'Tudo', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('link', { name: FOUND })).toBeVisible({ timeout: 25_000 });
});

test('Inbox, Minhas tarefas e a palette não rolam para os lados', async () => {
  await page.goto(`/w/${wsId}/inbox`);
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await expectNoHorizontalScroll(page);

  await page.goto(`/w/${wsId}/minhas-tarefas`);
  await expect(page.getByRole('heading', { name: 'Minhas tarefas', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('combobox', { name: 'Termo da busca' })).toBeVisible({
    timeout: 15_000,
  });
  await expectNoHorizontalScroll(page);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 900 });
});
