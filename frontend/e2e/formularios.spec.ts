import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/** Uma sessão só e uma List de Leads própria. */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F14 Formulários ${stamp}`;
const LIST = `Leads ${stamp}`;
const LEAD = `Cliente ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId: string;
let spaceId = '';
let listId = '';
let publicUrl = '';

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;
  spaceId = await createResource(session, 'spaces', { name: SPACE });
  listId = await createResource(session, 'lists', { spaceId, name: LIST });

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

test('a view Formulário cria o formulário da List e mostra o link público', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/l/${listId}`);

  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();

  await page.getByRole('button', { name: 'Adicionar view' }).click();
  await page.getByRole('menuitem', { name: 'Formulário' }).click();

  // A view nasce na barra; abri-la mostra o construtor da List.
  await page.getByRole('button', { name: /^Formulário/ }).click();

  await expect(page.getByText('Nenhum formulário nesta List')).toBeVisible();

  await page.getByRole('button', { name: 'Criar formulário' }).click();

  const config = page.getByRole('complementary', { name: 'Configuração do formulário' });

  await expect(config.getByLabel('Título')).toHaveValue(`Formulário de ${LIST}`);

  const link = config.getByText(/\/f\//);

  await expect(link).toBeVisible();

  publicUrl = (await link.innerText()).trim();

  expect(publicUrl, 'endereço público do formulário').toContain('/f/');

  // A prévia desenha o que o cliente vai ver.
  const preview = page.getByRole('region', { name: 'Prévia do formulário público' });

  await expect(preview.getByLabel(/^Nome/)).toBeVisible();
  await expect(preview.getByLabel(/^Mensagem/)).toBeVisible();
});

test('o construtor muda a pergunta, mapeia e grava', async () => {
  const config = page.getByRole('complementary', { name: 'Configuração do formulário' });

  await config.getByLabel('Pergunta', { exact: true }).nth(1).fill('Contato');
  await config.getByLabel('Preenche na tarefa').nth(1).selectOption('description');
  await config.getByLabel('Obrigatório').nth(2).click();

  await config.getByRole('button', { name: 'Nova condição' }).click();
  await config.getByLabel('Pergunta observada').selectOption({ index: 0 });
  await config.getByLabel('Operador da condição').selectOption('isNotEmpty');
  await config.getByLabel('Mostrar Mensagem').check();

  await config.getByRole('button', { name: 'Salvar formulário' }).click();

  await expect(page.getByText('Formulário salvo.')).toBeVisible();

  // A condição esconde a Mensagem na prévia até o Nome ser preenchido.
  const preview = page.getByRole('region', { name: 'Prévia do formulário público' });

  await expect(preview.getByLabel(/^Mensagem/)).toHaveCount(0);
  await preview.getByLabel(/^Nome/).fill('Ana');
  await expect(preview.getByLabel(/^Mensagem/)).toBeVisible();
});

test('o envio público cria a tarefa na List de Leads', async ({ browser }) => {
  // Contexto sem cookie: a página pública não tem sessão nenhuma.
  const anonymous = await browser.newContext();
  const guest = await anonymous.newPage();

  await guest.goto(publicUrl);

  await expect(
    guest.getByRole('heading', { level: 1, name: `Formulário de ${LIST}` }),
  ).toBeVisible();

  // O honeypot existe, mas fora do olho e do leitor de tela.
  await expect(guest.locator('input[name="website"]')).toHaveCount(1);
  await expect(guest.locator('input[name="website"]')).not.toBeVisible();

  await guest.getByRole('button', { name: 'Enviar' }).click();

  await expect(guest.getByText('Preencha este campo.').first()).toBeVisible();

  await guest.getByLabel(/^Nome/).fill(LEAD);
  await guest.getByLabel(/^Contato/).fill('ana@exemplo.dev');
  await guest.getByLabel(/^Mensagem/).fill('Quero conhecer o PDV.');
  await guest.getByRole('button', { name: 'Enviar' }).click();

  await expect(guest.getByRole('heading', { name: 'Recebido.' })).toBeVisible();
  await expect(guest.getByText(/^[A-Z]{2,4}-\d+$/)).toBeVisible();

  await expectNoHorizontalScroll(guest);
  await anonymous.close();

  // A tarefa do envio aparece na List.
  await page.goto(`/w/${wsId}/l/${listId}`);
  await page.getByRole('button', { name: /^Lista/ }).click();

  await expect(page.getByRole('link', { name: LEAD })).toBeVisible();
});

test('o construtor cabe em 360, 768 e 1280', async () => {
  await page.goto(`/w/${wsId}/l/${listId}`);
  await page.getByRole('button', { name: /^Formulário/ }).click();

  await expect(
    page.getByRole('complementary', { name: 'Configuração do formulário' }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});
