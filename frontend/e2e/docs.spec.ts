import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e um Space próprio: o Doc do seed fica intocado. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F12 Docs ${stamp}`;
const LIST = `Escopo ${stamp}`;
const TASK = `Tarefa do Doc ${stamp}`;
const DOC = `Guia ${stamp}`;
const SUBPAGE = `Passo a passo ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let spaceId = '';
let taskCustomId = '';
let publicUrl = '';

interface StatusBody {
  id: string;
  name: string;
  group: string;
}

interface TaskBody {
  id: string;
  customId: string;
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

  expect(open, 'status inicial da List').toBeTruthy();

  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name: TASK, statusId: open?.id },
  });

  expect(created.ok(), 'criação da tarefa do Doc').toBeTruthy();

  taskCustomId = ((await created.json()) as TaskBody).customId;

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

test('cria o Doc pelo hub e uma subpágina na árvore', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/docs`);

  await expect(page.getByRole('heading', { level: 1, name: 'Docs' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo Doc' }).first().click();
  await page.getByLabel('Título').fill(DOC);
  await page.getByRole('button', { name: 'Criar Doc' }).click();

  await expect(page.getByRole('heading', { level: 1, name: DOC })).toBeVisible();
  await expect(page.getByText('Este Doc ainda não tem páginas')).toBeVisible();

  await page.getByRole('button', { name: 'Nova página' }).click();

  const tree = page.getByRole('list', { name: 'Páginas do Doc' });

  await expect(tree.getByRole('button', { name: 'Nova página', exact: true })).toBeVisible();
  await expect(page.getByLabel('Título da página')).toHaveValue('Nova página');

  await page.getByRole('button', { name: 'Ações de Nova página' }).click();
  await page.getByRole('menuitem', { name: 'Subpágina' }).click();

  await expect(tree.getByRole('button', { name: 'Nova página', exact: true })).toHaveCount(2);

  await page.getByLabel('Título da página').fill(SUBPAGE);
  await expect(page.getByRole('status', { name: 'Estado do salvamento' })).toContainText('Salvo');

  await page.reload();

  await expect(tree.getByRole('button', { name: SUBPAGE, exact: true })).toBeVisible();
});

test('menciona a tarefa e o chip mostra o status ao vivo', async () => {
  const editor = page.getByRole('textbox', { name: 'Conteúdo da página' });

  await editor.click();
  await editor.pressSequentially(`Depende de #${stamp}`, { delay: 25 });

  const menu = page.getByRole('listbox', { name: 'Sugestões da menção' });

  await expect(menu).toBeVisible({ timeout: 15_000 });
  await expect(menu.getByRole('option', { name: new RegExp(TASK) })).toBeVisible();
  await menu.getByRole('option', { name: new RegExp(TASK) }).click();

  await expect(editor.getByRole('link', { name: new RegExp(`Tarefa ${TASK}`) })).toBeVisible();
  await expect(editor.getByText(taskCustomId)).toBeVisible();
  await expect(page.getByRole('status', { name: 'Estado do salvamento' })).toContainText('Salvo');
});

test('o menu de comandos insere uma citação', async () => {
  const editor = page.getByRole('textbox', { name: 'Conteúdo da página' });

  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await editor.pressSequentially('/citação', { delay: 25 });

  const commands = page.getByRole('listbox', { name: 'Comandos do editor' });

  await expect(commands.getByRole('option', { name: /Citação/ })).toBeVisible();
  await commands.getByRole('option', { name: /Citação/ }).click();
  await editor.pressSequentially('Cuidado com o prazo.', { delay: 10 });

  await expect(editor.locator('blockquote')).toContainText('Cuidado com o prazo.');
  await expect(page.getByRole('status', { name: 'Estado do salvamento' })).toContainText('Salvo');
});

test('comenta ancorado no trecho selecionado', async () => {
  const editor = page.getByRole('textbox', { name: 'Conteúdo da página' });

  await editor.locator('blockquote').dblclick();

  const comments = page.getByRole('complementary', { name: 'Comentários' });

  await expect(comments.getByText(/Ancorado em/)).toBeVisible();

  await comments.getByLabel('Novo comentário').fill('Alinhar com o cliente.');
  await comments.getByRole('button', { name: 'Comentar' }).click();

  await expect(comments.getByText('Alinhar com o cliente.')).toBeVisible();
  await expect(comments.getByText(/“/).first()).toBeVisible();
});

test('compartilha o Doc e a página pública abre sem login', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Link público somente leitura').click();

  const url = dialog.getByLabel('Endereço público');

  await expect(url).not.toHaveValue(/Gere um link/);

  publicUrl = await url.inputValue();

  expect(publicUrl).toContain('/p/doc/');

  await dialog.getByRole('button', { name: 'Fechar', exact: true }).first().click();

  const anonymous = await page.context().browser()?.newContext();

  expect(anonymous, 'contexto sem sessão').toBeTruthy();

  const guest = await anonymous!.newPage();
  const path = new URL(publicUrl).pathname;

  await guest.goto(path);

  await expect(guest.getByText('Somente leitura')).toBeVisible();

  const pages = guest.getByRole('navigation', { name: 'Páginas do Doc' });

  await pages.getByRole('button', { name: SUBPAGE, exact: true }).click();

  await expect(guest.getByRole('heading', { level: 1, name: SUBPAGE })).toBeVisible();
  await expect(guest.getByText('Cuidado com o prazo.')).toBeVisible();
  await expect(guest.getByRole('textbox', { name: 'Conteúdo da página' })).toHaveCount(0);

  await expectNoHorizontalScroll(guest);
  await anonymous!.close();
});

test('restaura uma versão anterior da página', async () => {
  const editor = page.getByRole('textbox', { name: 'Conteúdo da página' });

  await editor.click();
  await page.keyboard.press('End');
  await editor.pressSequentially(' Texto que será desfeito.', { delay: 10 });

  await expect(page.getByRole('status', { name: 'Estado do salvamento' })).toContainText('Salvo');

  await page.getByRole('button', { name: 'Histórico de versões' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Histórico de versões' })).toBeVisible();
  await expect(dialog.getByRole('list', { name: 'Versões da página' })).toBeVisible();

  await dialog.getByRole('list', { name: 'Versões da página' }).getByRole('button').first().click();
  await dialog.getByRole('button', { name: 'Restaurar esta versão' }).click();

  await expect(dialog).toBeHidden();
  await expect(editor).not.toContainText('Texto que será desfeito.');
});

test('o hub e o editor não rolam para os lados em 360, 768 e 1280', async () => {
  await page.goto(`/w/${wsId}/docs`);
  await expect(page.getByRole('heading', { level: 1, name: 'Docs' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: DOC }).click();

  await expect(page.getByLabel('Título da página')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole('button', { name: 'Abrir páginas do Doc' }).click();

  await expect(page.getByRole('list', { name: 'Páginas do Doc' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expectNoHorizontalScroll(page);

  // 1024 é o ponto em que a árvore volta a ser coluna fixa.
  await page.setViewportSize({ width: 1024, height: 820 });
  await expect(page.getByRole('list', { name: 'Páginas do Doc' })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(overflow.scrollWidth, 'rolagem horizontal em 1024 px').toBeLessThanOrEqual(
    overflow.innerWidth,
  );
});
