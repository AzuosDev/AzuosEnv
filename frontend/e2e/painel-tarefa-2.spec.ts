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
 * Painel da tarefa, parte 2 (F8): comentários, anexos, dependências, campos
 * personalizados e tempo real. Uma sessão por arquivo e um Space próprio, para
 * não mexer no que os outros specs conferem.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F8 Colaboracao ${stamp}`;
const LIST = `Colaboracao ${stamp}`;
const TASK = `Revisar integracao ${stamp}`;
const OTHER = `Tarefa sem campo ${stamp}`;
const BLOCKER = `Liberar ambiente ${stamp}`;
const FIELD = `Tipo ${stamp}`;
const COMMENT = `Conferir o retorno do webhook ${stamp}`;
const REPLY = `Respondido, segue o log ${stamp}`;
const FILE = `nota-${stamp}.txt`;

interface TaskBody {
  id: string;
  customId: string;
  name: string;
}

interface FieldBody {
  id: string;
  config: { options?: { id: string; name: string }[] };
}

interface CommentBody {
  id: string;
  bodyText: string;
  mentions: string[];
  parentCommentId: string | null;
  reactions: { emoji: string; userIds: string[] }[];
}

interface ThreadsBody {
  items: { comment: CommentBody; replies: CommentBody[] }[];
}

interface AttachmentBody {
  id: string;
  name: string;
  size: number;
}

let page: Page;
let session: AdminApi;
let wsId: string;
let listId: string;
let task: TaskBody;
let field: FieldBody;
let member: Credentials;

async function createTask(name: string): Promise<TaskBody> {
  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name },
  });

  expect(created.ok(), `criação da tarefa ${name}`).toBeTruthy();

  return (await created.json()) as TaskBody;
}

async function readThreads(): Promise<ThreadsBody> {
  const response = await session.api.get(
    `${API_URL}/workspaces/${wsId}/tasks/${task.customId}/comments`,
    { headers: session.headers },
  );

  expect(response.ok(), 'leitura dos comentários').toBeTruthy();

  return (await response.json()) as ThreadsBody;
}

async function readAttachments(): Promise<AttachmentBody[]> {
  const response = await session.api.get(
    `${API_URL}/workspaces/${wsId}/tasks/${task.customId}/attachments`,
    { headers: session.headers },
  );

  expect(response.ok(), 'leitura dos anexos').toBeTruthy();

  return (await response.json()) as AttachmentBody[];
}

/** Abre o painel pelo link direto e espera o nome carregado. */
async function openPanel(target = task, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/w/${wsId}/t/${target.customId}`);
  await expect(page.getByLabel('Nome da tarefa')).toHaveValue(target.name, { timeout: 15_000 });
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', {
    name: SPACE,
    statusTemplate: 'simples',
  });

  listId = await createResource(session, 'lists', { spaceId, name: LIST });

  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/custom-fields`, {
    headers: session.headers,
    data: {
      scope: 'list',
      scopeId: listId,
      name: FIELD,
      type: 'dropdown',
      config: { options: [{ name: 'Bug' }, { name: 'Melhoria' }] },
    },
  });

  expect(created.ok(), 'criação do campo personalizado').toBeTruthy();
  field = (await created.json()) as FieldBody;

  task = await createTask(TASK);
  await createTask(OTHER);
  await createTask(BLOCKER);
  member = await createWorkspaceMember(`f8-${stamp}`, 'member');

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('comenta com menção, responde na thread e reage', async () => {
  await openPanel();

  const composer = page.getByRole('textbox', { name: 'Novo comentário' });

  await composer.click();
  await composer.pressSequentially(`${COMMENT} `);
  await composer.pressSequentially('@Azu');

  const suggestions = page.getByRole('listbox', { name: 'Sugestões da menção' });

  await expect(suggestions).toBeVisible({ timeout: 15_000 });
  await suggestions.getByRole('option', { name: /Azuos Admin/ }).click();

  await page.getByRole('button', { name: 'Comentar' }).click();

  await expect.poll(async () => (await readThreads()).items.length, { timeout: 15_000 }).toBe(1);

  const threads = await readThreads();
  const root = threads.items[0]?.comment;

  expect(root?.bodyText).toContain(COMMENT);
  expect(root?.mentions.length, 'a menção foi gravada').toBe(1);

  await expect(page.getByText(COMMENT, { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Responder' }).first().click();

  const replyBox = page.getByRole('textbox', { name: /^Responder a / });

  await replyBox.click();
  await replyBox.pressSequentially(REPLY);
  await page.getByRole('button', { name: 'Responder', exact: true }).last().click();

  await expect
    .poll(async () => (await readThreads()).items[0]?.replies.length ?? 0, { timeout: 15_000 })
    .toBe(1);

  await expect(page.getByText(REPLY, { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Reagir' }).first().click();
  await page.getByRole('button', { name: 'Reagir com 👍' }).click();

  await expect
    .poll(async () => (await readThreads()).items[0]?.comment.reactions[0]?.userIds.length ?? 0, {
      timeout: 15_000,
    })
    .toBe(1);

  await expect(page.getByRole('button', { name: '👍 1' })).toBeVisible();
});

test('envia um anexo, mostra na lista e baixa o arquivo', async () => {
  await openPanel();

  await page.setInputFiles('#task-attachment-input', {
    name: FILE,
    mimeType: 'text/plain',
    buffer: Buffer.from('registro de conferência do webhook\n'),
  });

  await expect.poll(async () => (await readAttachments()).length, { timeout: 20_000 }).toBe(1);

  const row = page.getByRole('listitem').filter({ hasText: FILE });

  await expect(row).toBeVisible({ timeout: 15_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    page.getByRole('button', { name: `Baixar ${FILE}` }).click(),
  ]);

  expect(download.suggestedFilename()).toBe(FILE);
});

test('liga uma dependência e avisa que a tarefa está bloqueada', async () => {
  await openPanel();

  // A view da List fica por baixo do painel: toda asserção mira no painel.
  const panel = page.getByRole('complementary', { name: 'Detalhes da tarefa' });

  await panel.getByRole('button', { name: 'Adicionar em Aguardando' }).click();

  const popover = page.getByRole('dialog').filter({
    has: page.getByLabel('Buscar tarefa para Aguardando'),
  });

  await popover.getByLabel('Buscar tarefa para Aguardando').fill(BLOCKER.slice(0, 12));
  await popover.getByRole('button', { name: new RegExp(BLOCKER) }).click();

  await expect(panel.getByRole('link', { name: new RegExp(BLOCKER) })).toBeVisible({
    timeout: 15_000,
  });
  await expect(panel.getByText('Bloqueada', { exact: true })).toBeVisible();
  await expect(panel.getByRole('status').filter({ hasText: 'está bloqueada' })).toBeVisible();
});

test('o campo personalizado vira coluna e filtro da Lista', async () => {
  const option = field.config.options?.find((item) => item.name === 'Bug');

  expect(option, 'opção Bug do campo').toBeTruthy();

  await openPanel();

  await page.getByLabel(FIELD).selectOption(option?.id ?? '');

  await expect
    .poll(
      async () => {
        const response = await session.api.get(
          `${API_URL}/workspaces/${wsId}/tasks/${task.customId}`,
          { headers: session.headers },
        );
        const body = (await response.json()) as {
          customFields: { fieldId: string; value: unknown }[];
        };

        return body.customFields.find((item) => item.fieldId === field.id)?.value;
      },
      { timeout: 15_000 },
    )
    .toBe(option?.id);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();

  await page.getByRole('button', { name: 'Colunas' }).click();
  await page.getByRole('checkbox', { name: FIELD }).check();
  await page.keyboard.press('Escape');

  await expect(page.getByText(FIELD, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByLabel(`Filtro de ${FIELD}`).selectOption('eq');
  await page.getByLabel(`Valor de ${FIELD}`).selectOption(option?.id ?? '');
  await page.keyboard.press('Escape');

  await expect(page.getByRole('link', { name: TASK })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: OTHER })).toBeHidden();
});

test('a edição de uma pessoa aparece na tela da outra sem recarregar', async ({ browser }) => {
  const second = await browser.newContext();

  await signInContext(second, member);

  const other = await second.newPage();

  try {
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.goto(`/w/${wsId}/t/${task.customId}`);
    await expect(other.getByLabel('Nome da tarefa')).toHaveValue(task.name, { timeout: 20_000 });

    await openPanel();

    const renamed = `${TASK} em tempo real`;

    await page.getByLabel('Nome da tarefa').fill(renamed);

    await expect(other.getByLabel('Nome da tarefa')).toHaveValue(renamed, { timeout: 25_000 });
    await expect(page.getByLabel(/^Vendo agora:/)).toBeVisible({ timeout: 20_000 });

    task = { ...task, name: renamed };
  } finally {
    await other.close();
    await second.close();
  }
});

test('o painel e a Lista não rolam para os lados em 360, 768 e 1280', async () => {
  await openPanel();
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
