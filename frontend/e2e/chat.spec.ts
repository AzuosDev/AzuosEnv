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
 * Uma sessão para o arquivo e um Space, uma List e um canal próprios: os canais
 * do seed continuam intocados para os outros specs.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F13 Chat ${stamp}`;
const LIST = `Conversa ${stamp}`;
const CHANNEL = `f13-${stamp}`;
const ADMIN_NAME = 'Azuos Admin';

let page: Page;
let session: AdminApi;
let wsId: string;
let listId: string;
let channelId: string;
let member: Credentials;

async function createChannel(data: Record<string, unknown>): Promise<string> {
  return createResource(session, 'channels', data);
}

async function sendByApi(text: string): Promise<string> {
  const response = await session.api.post(
    `${API_URL}/workspaces/${wsId}/channels/${channelId}/messages`,
    { headers: session.headers, data: { bodyText: text } },
  );

  expect(response.ok(), 'envio da mensagem pela API').toBeTruthy();

  return ((await response.json()) as { id: string }).id;
}

/** Escreve no editor compacto, que é contenteditable e não aceita fill. */
async function type(target: Page, label: string, text: string): Promise<void> {
  const editor = target.getByRole('textbox', { name: label });

  await editor.click();
  await target.keyboard.type(text);
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', {
    name: SPACE,
    statusTemplate: 'simples',
  });

  listId = await createResource(session, 'lists', { spaceId, name: LIST });
  channelId = await createChannel({ name: CHANNEL, locationType: 'list', locationId: listId });
  member = await createWorkspaceMember(`f13-${stamp}`, 'member');

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('dois navegadores conversando em tempo real', async ({ browser }) => {
  const second = await browser.newContext();

  await signInContext(second, member);

  const other = await second.newPage();

  try {
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.goto(`/w/${wsId}/chat?canal=${channelId}`);
    await expect(other.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible({
      timeout: 25_000,
    });

    await page.goto(`/w/${wsId}/chat?canal=${channelId}`);
    await expect(page.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible({
      timeout: 25_000,
    });

    const mine = `Deploy da 3.2 combinado ${stamp}`;

    await type(page, `Mensagem para ${CHANNEL}`, mine);
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText(mine)).toBeVisible({ timeout: 20_000 });
    // A mensagem chega na sala channel:{id} do outro navegador.
    await expect(other.getByText(mine)).toBeVisible({ timeout: 25_000 });

    const theirs = `Confirmo com a Cênio ${stamp}`;

    await type(other, `Mensagem para ${CHANNEL}`, theirs);
    await other.getByRole('button', { name: 'Enviar' }).click();

    await expect(other.getByText(theirs)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(theirs)).toBeVisible({ timeout: 25_000 });
  } finally {
    await other.close();
    await second.close();
  }
});

test('thread responde a mensagem e conta as respostas', async () => {
  const root = `Dúvida do estoque ${stamp}`;

  await sendByApi(root);
  await page.goto(`/w/${wsId}/chat?canal=${channelId}`);

  const message = page
    .getByRole('article', { name: `Mensagem de ${ADMIN_NAME}` })
    .filter({ hasText: root });

  await expect(message).toBeVisible({ timeout: 25_000 });

  await message.getByRole('button', { name: 'Responder em thread' }).click();
  await expect(page.getByRole('heading', { name: 'Thread', level: 2 })).toBeVisible();

  const reply = `Bloqueio no front e no sync ${stamp}`;

  await type(page, 'Resposta da thread', reply);
  await page.getByRole('button', { name: 'Responder', exact: true }).click();

  await expect(page.getByText(reply)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: '1 resposta na thread' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Fechar a thread' }).click();
  await expect(page.getByRole('heading', { name: 'Thread', level: 2 })).toBeHidden();
});

test('a mensagem vira tarefa na List escolhida', async () => {
  const text = `Homologar impressora ${stamp}`;

  await sendByApi(text);
  await page.goto(`/w/${wsId}/chat?canal=${channelId}`);

  const message = page
    .getByRole('article', { name: `Mensagem de ${ADMIN_NAME}` })
    .filter({ hasText: text });

  await expect(message).toBeVisible({ timeout: 25_000 });

  await message.getByRole('button', { name: `Ações da mensagem de ${ADMIN_NAME}` }).click();
  await page.getByRole('menuitem', { name: 'Criar tarefa' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Criar tarefa da mensagem' })).toBeVisible();
  await dialog.getByLabel('List').selectOption({ label: LIST });
  await dialog.getByRole('button', { name: 'Criar tarefa' }).click();

  await expect(page.getByText(/Tarefa AZD-\d+ criada\./)).toBeVisible({ timeout: 25_000 });

  // A tarefa nasceu na List, com o nome tirado da mensagem.
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 25_000 });
});

test('as não lidas aparecem e zeram ao abrir o canal', async ({ browser }) => {
  const second = await browser.newContext();

  await signInContext(second, member);

  const other = await second.newPage();

  try {
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.goto(`/w/${wsId}/chat`);

    const row = other
      .getByRole('navigation', { name: 'Canais' })
      .getByRole('button', { name: new RegExp(CHANNEL) });

    await expect(row).toBeVisible({ timeout: 25_000 });

    await sendByApi(`Mensagem não lida ${stamp}`);

    await expect(row).toContainText('não lidas', { timeout: 25_000 });

    await row.click();
    await expect(other.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(row).not.toContainText('não lidas', { timeout: 25_000 });
  } finally {
    await other.close();
    await second.close();
  }
});

test('o canal aparece como view da List', async () => {
  await page.goto(`/w/${wsId}/l/${listId}`);
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible({
    timeout: 25_000,
  });

  await page.getByRole('button', { name: 'Adicionar view' }).click();
  await page.getByRole('menuitem', { name: 'Chat' }).click();

  // Criar a view só põe a aba na barra; abrir é um clique nela.
  await page.getByRole('button', { name: /^Chat/ }).click();

  await expect(page.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible({
    timeout: 25_000,
  });
});

test('a pilha de três telas do celular e o responsivo', async () => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(`/w/${wsId}/chat`);

  // Tela 1: a lista de canais ocupa a tela.
  const row = page
    .getByRole('navigation', { name: 'Canais' })
    .getByRole('button', { name: new RegExp(CHANNEL) });

  await expect(row).toBeVisible({ timeout: 25_000 });
  await row.click();

  // Tela 2: a conversa, com o caminho de volta.
  await expect(page.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: 'Voltar para os canais' })).toBeVisible();

  // Tela 3: a thread em tela cheia.
  const thread = page.getByRole('button', { name: /resposta[s]? na thread/ }).first();

  await expect(thread).toBeVisible({ timeout: 20_000 });
  await thread.click();
  await expect(page.getByRole('heading', { name: 'Thread', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: CHANNEL, level: 2 })).toBeHidden();

  await page.getByRole('button', { name: 'Fechar a thread' }).click();
  await expect(page.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'Voltar para os canais' }).click();
  await expect(row).toBeVisible();

  await expectNoHorizontalScroll(page);

  await page.goto(`/w/${wsId}/chat?canal=${channelId}`);
  await expect(page.getByRole('heading', { name: CHANNEL, level: 2 })).toBeVisible({
    timeout: 25_000,
  });
  await expectNoHorizontalScroll(page);

  await page.goto(`/w/${wsId}/chat?canal=${channelId}&thread=${String(await firstRootId())}`);
  await expect(page.getByRole('heading', { name: 'Thread', level: 2 })).toBeVisible({
    timeout: 25_000,
  });
  await expectNoHorizontalScroll(page);
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** Id da mensagem mais nova do canal, para abrir a thread pela URL. */
async function firstRootId(): Promise<string> {
  const response = await session.api.get(
    `${API_URL}/workspaces/${wsId}/channels/${channelId}/messages?limit=1`,
    { headers: session.headers },
  );

  expect(response.ok(), 'listagem das mensagens').toBeTruthy();

  const { items } = (await response.json()) as { items: { id: string }[] };

  return items[0]?.id ?? '';
}
