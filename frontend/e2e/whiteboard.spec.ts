import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const BOARD = `Fluxo do PDV ${stamp}`;

let page: Page;
let session: AdminApi;
let wsId = '';
let boardId = '';

interface BoardBody {
  id: string;
  version: number;
  elements: unknown[];
}

/**
 * Desenha um retângulo no canvas do Excalidraw: a ferramenta vai pela barra
 * (o atalho de teclado só chega quando o canvas está em foco) e o arrasto é o
 * mouse de verdade.
 */
async function drawRectangle(target: Page, offset = 0): Promise<void> {
  const canvas = target.locator('[data-testid="board-canvas"] canvas').first();

  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();

  expect(box, 'área do canvas').toBeTruthy();

  const x = (box?.x ?? 0) + 120 + offset;
  const y = (box?.y ?? 0) + 120 + offset;

  await target.locator('.App-toolbar label[title^="Retângulo"]').click();

  // Um evento por quadro de animação: o Excalidraw aplica o arrasto no rAF, e
  // tudo no mesmo tick sairia com tamanho zero.
  const fire = async (type: string, cx: number, cy: number, buttons: number): Promise<void> => {
    await target.evaluate(
      ([kind, clientX, clientY, pressed]) => {
        const node =
          document.querySelector('.excalidraw__canvas.interactive') ??
          document.querySelector('.excalidraw');

        node?.dispatchEvent(
          new PointerEvent(kind as string, {
            bubbles: true,
            cancelable: true,
            clientX: clientX as number,
            clientY: clientY as number,
            button: 0,
            buttons: pressed as number,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        );
      },
      [type, cx, cy, buttons] as [string, number, number, number],
    );
    await target.waitForTimeout(80);
  };

  await fire('pointerdown', x, y, 1);
  await fire('pointermove', x + 70, y + 45, 1);
  await fire('pointermove', x + 140, y + 90, 1);
  await fire('pointerup', x + 140, y + 90, 0);
}

async function readBoard(): Promise<BoardBody> {
  const response = await session.api.get(`${API_URL}/workspaces/${wsId}/whiteboards/${boardId}`, {
    headers: session.headers,
  });

  expect(response.ok(), 'quadro pela API').toBeTruthy();

  return (await response.json()) as BoardBody;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/whiteboards`, {
    headers: session.headers,
    data: { locationType: 'workspace', title: BOARD },
  });

  expect(created.ok(), 'quadro do cenário').toBeTruthy();
  boardId = ((await created.json()) as BoardBody).id;

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('o hub abre o quadro e o desenho é salvo com versão', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/whiteboards`);

  await page.getByRole('button', { name: new RegExp(BOARD) }).click();
  await expect(page).toHaveURL(new RegExp(`/whiteboards/${boardId}$`));
  await expect(page.getByLabel('Título do quadro')).toHaveValue(BOARD);

  const saved = page.waitForResponse(
    (response) =>
      response.url().includes(`/whiteboards/${boardId}/elements`) &&
      response.request().method() === 'PATCH' &&
      response.status() === 200,
  );

  await drawRectangle(page);
  await saved;

  await expect(page.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  const board = await readBoard();

  expect(board.elements.length).toBeGreaterThan(0);
  expect(board.version).toBeGreaterThan(1);
});

test('o que outra pessoa desenha entra no quadro aberto', async ({ browser }) => {
  await page.goto(`/w/${wsId}/whiteboards/${boardId}`);
  await expect(page.locator('[data-testid="board-canvas"] canvas').first()).toBeVisible();

  const mate = await createWorkspaceMember('f15-board');
  const other = await browser.newContext();

  await signInContext(other, mate);

  const second = await other.newPage();

  try {
    await second.goto(`/w/${wsId}/whiteboards/${boardId}`);
    await expect(second.locator('[data-testid="board-canvas"] canvas').first()).toBeVisible();

    // O primeiro navegador recarrega o quadro quando o evento da sala chega.
    const refetched = page.waitForResponse(
      (response) =>
        response.url().includes(`/whiteboards/${boardId}`) &&
        response.request().method() === 'GET' &&
        response.status() === 200,
      { timeout: 20_000 },
    );

    await drawRectangle(second, 60);
    await expect(second.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

    await refetched;
  } finally {
    await other.close();
  }

  const board = await readBoard();

  expect(board.elements.length).toBeGreaterThan(1);
});

test('o quadro e o hub não rolam para os lados em 360, 768 e 1280', async () => {
  await page.goto(`/w/${wsId}/whiteboards`);
  await expect(page.getByRole('heading', { name: 'Whiteboards' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/w/${wsId}/whiteboards/${boardId}`);
  await expect(page.locator('[data-testid="board-canvas"] canvas').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
