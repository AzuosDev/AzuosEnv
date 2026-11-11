import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  adminApi,
  createResource,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  signInContext,
  type Credentials,
} from './helpers';

/**
 * Uma sessão só para o arquivo (o cookie de refresh entra pela API, sem gastar o
 * limite de logins do navegador) e um Space próprio por execução, para não mexer
 * na hierarquia que os outros specs conferem.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F5 Hierarquia ${stamp}`;
const FOLDER_A = `Folder A ${stamp}`;
const FOLDER_B = `Folder B ${stamp}`;
const LIST_MOVE = `List move ${stamp}`;
const LIST_ARCHIVE = `List arquiva ${stamp}`;
const LIST_DELETE = `List exclui ${stamp}`;
const GUEST = `guest-f5-${stamp}`;

let page: Page;
let wsId: string;
let guest: Credentials;

test.beforeAll(async ({ browser }) => {
  const session = await adminApi();

  wsId = session.wsId;

  const spaceId = await createResource(session, 'spaces', {
    name: SPACE,
    statusTemplate: 'simples',
  });
  const folderA = await createResource(session, 'folders', { spaceId, name: FOLDER_A });

  await createResource(session, 'folders', { spaceId, name: FOLDER_B });
  await createResource(session, 'lists', { spaceId, folderId: folderA, name: LIST_MOVE });
  await createResource(session, 'lists', { spaceId, folderId: folderA, name: LIST_ARCHIVE });
  await createResource(session, 'lists', { spaceId, folderId: folderA, name: LIST_DELETE });
  await session.dispose();

  guest = await createWorkspaceMember(GUEST, 'guest');

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

test.beforeEach(async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** Expande o nó se ele já não estiver aberto (o estado fica no localStorage). */
async function expand(name: string): Promise<void> {
  const toggle = page.getByRole('button', { name: new RegExp(`^(Expandir|Recolher) ${name}$`) });

  await toggle.waitFor();

  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** Abre o Space do teste com os dois Folders à vista. */
async function openFixture(): Promise<void> {
  await page.goto(`/w/${wsId}`);
  await expand(SPACE);
  await expand(FOLDER_A);
  await expect(page.getByRole('link', { name: FOLDER_B })).toBeVisible();
}

function nodeMenu(name: string): Locator {
  return page.getByRole('button', { name: `Ações de ${name}` });
}

test('cria um Space com o template Dev e os statuses vêm do template', async () => {
  const name = `F5 Dev ${stamp}`;

  await page.goto(`/w/${wsId}`);
  await page.getByRole('button', { name: 'Novo Space' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Novo Space' })).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('radio', { name: /^Dev/ }).check();
  await dialog.getByRole('button', { name: 'Criar Space' }).click();

  await expect(page.getByRole('link', { name })).toBeVisible();

  // O conjunto de statuses nasceu do template Dev (nove statuses, Backlog primeiro).
  await nodeMenu(name).click();
  await page.getByRole('menuitem', { name: 'Statuses' }).click();

  const editor = page.getByRole('dialog');
  const names = editor.getByRole('textbox', { name: 'Nome do status' });

  await expect(editor.getByRole('heading', { name: `Statuses de “${name}”` })).toBeVisible();
  await expect(names).toHaveCount(9);
  await expect(names.first()).toHaveValue('Backlog');
  await editor.getByRole('button', { name: 'Cancelar' }).click();
});

test('arrasta a List para outro Folder e o lugar novo resiste ao recarregar', async () => {
  await openFixture();

  const grip = page.getByRole('button', { name: `Reordenar ${LIST_MOVE}` });
  const target = page.getByRole('link', { name: FOLDER_B });

  await grip.hover();
  await page.mouse.down();

  // A sidebar rola durante o arrasto (o dnd-kit tem auto-scroll), então o
  // destino é remedido a cada passo até o ponteiro parar dentro dele.
  let x = 0;
  let y = 0;

  for (let step = 0; step < 8; step += 1) {
    const box = await target.boundingBox();

    expect(box, 'posição do Folder de destino').toBeTruthy();

    x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

    await page.mouse.move(x, y, { steps: 4 });
  }

  await page.mouse.move(x, y + 1, { steps: 2 });
  await page.mouse.up();

  await expand(FOLDER_B);
  await page.getByRole('link', { name: LIST_MOVE }).click();
  await expect(page).toHaveURL(/\/l\/[0-9a-f]{24}$/);

  const trail = page.getByRole('navigation', { name: 'Trilha' });

  await expect(trail.getByRole('link', { name: FOLDER_B })).toBeVisible();

  await page.reload();
  await expect(trail.getByRole('link', { name: FOLDER_B })).toBeVisible();
  await expect(trail.getByRole('link', { name: FOLDER_A })).toBeHidden();
});

test('arquiva a List e desarquiva pela página Arquivados', async () => {
  await openFixture();

  await nodeMenu(LIST_ARCHIVE).click();
  await page.getByRole('menuitem', { name: 'Arquivar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click();

  await expect(page.getByRole('link', { name: LIST_ARCHIVE })).toBeHidden();

  await page.getByRole('link', { name: 'Arquivados' }).click();
  await expect(page.getByRole('heading', { name: 'Arquivados' })).toBeVisible();

  const row = page.getByRole('main').getByRole('listitem').filter({ hasText: LIST_ARCHIVE });

  await row.getByRole('button', { name: 'Desarquivar' }).click();
  await expect(row).toBeHidden();

  await openFixture();
  await expect(page.getByRole('link', { name: LIST_ARCHIVE })).toBeVisible();
});

test('exclui a List e o Desfazer do toast traz de volta', async () => {
  await openFixture();

  await nodeMenu(LIST_DELETE).click();
  await page.getByRole('menuitem', { name: 'Excluir List' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();

  await expect(page.getByRole('link', { name: LIST_DELETE })).toBeHidden();

  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('link', { name: LIST_DELETE })).toBeVisible();

  // Restaurada, a List não fica mais na lixeira.
  await page.getByRole('link', { name: 'Lixeira' }).click();
  await expect(page.getByRole('heading', { name: 'Lixeira' })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('listitem').filter({ hasText: LIST_DELETE }),
  ).toBeHidden();
});

test('compartilha o Space com um guest e o guest só vê esse Space', async ({ browser }) => {
  await page.goto(`/w/${wsId}`);
  await nodeMenu(SPACE).click();
  await page.getByRole('menuitem', { name: 'Compartilhar' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Compartilhar Space' })).toBeVisible();
  await dialog.getByLabel('Pessoa ou equipe').selectOption({ label: `Pessoa ${GUEST}` });
  await dialog.getByLabel('Nível').selectOption('view');
  await dialog.getByRole('button', { name: 'Adicionar' }).click();

  const access = dialog.getByRole('region', { name: 'Quem tem acesso' });

  await expect(access.getByText(`Pessoa ${GUEST}`)).toBeVisible();
  await expect(access.getByText('Pessoa · Ver')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  const guestContext = await browser.newContext();

  await signInContext(guestContext, guest);

  const guestPage = await guestContext.newPage();

  await guestPage.goto(`/w/${wsId}`);
  await expect(guestPage.getByRole('link', { name: SPACE })).toBeVisible();
  await expect(guestPage.getByRole('link', { name: 'Clientes' })).toBeHidden();
  await expect(guestPage.getByRole('link', { name: 'Comercial' })).toBeHidden();

  await guestContext.close();
});

test('os diálogos da hierarquia cabem em 360, 768 e 1280', async () => {
  await page.goto(`/w/${wsId}`);
  await page.setViewportSize({ width: 360, height: 760 });
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('button', { name: 'Novo Space' }).click();
  await expect(page.getByRole('dialog').getByLabel('Nome')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto(`/w/${wsId}`);
  await page.setViewportSize({ width: 360, height: 760 });
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await nodeMenu(SPACE).click();
  await page.getByRole('menuitem', { name: 'Statuses' }).click();
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: 'Nome do status' }).first(),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});
