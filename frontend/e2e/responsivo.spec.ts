import { expect, test, type Page } from '@playwright/test';
import { adminApi, API_URL, createResource, signInContext, type AdminApi } from './helpers';

/** Varredura final: toda rota do app nas quatro larguras do CLAUDE.md. */
const SWEEP_WIDTHS = [360, 768, 1024, 1280] as const;

const SHOTS = 'test-results/responsivo';

let session: AdminApi;
let wsId: string;
let page: Page;
let spaceId: string;

interface Route {
  slug: string;
  path: string;
}

let routes: Route[] = [];

interface TaskBody {
  customId: string;
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

  spaceId = await createResource(session, 'spaces', {
    name: `Varredura ${String(Date.now())}`,
    statusTemplate: 'simples',
  });

  const folderId = await createResource(session, 'folders', { spaceId, name: 'Pasta' });
  const listId = await createResource(session, 'lists', { spaceId, name: 'Lista' });
  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name: 'Tarefa da varredura' },
  });

  expect(created.ok(), 'criação da tarefa da varredura').toBeTruthy();

  const { customId } = (await created.json()) as TaskBody;

  const docId = await createResource(session, 'docs', {
    locationType: 'list',
    locationId: listId,
    title: 'Doc da varredura',
  });
  const goalId = await createResource(session, 'goals', { name: 'Meta da varredura' });
  const dashboardId = await createResource(session, 'dashboards', {
    name: 'Dashboard da varredura',
    private: false,
  });
  const whiteboardId = await createResource(session, 'whiteboards', {
    locationType: 'list',
    locationId: listId,
    title: 'Quadro da varredura',
  });

  const ws = `/w/${wsId}`;

  routes = [
    { slug: 'home', path: ws },
    { slug: 'inbox', path: `${ws}/inbox` },
    { slug: 'minhas-tarefas', path: `${ws}/minhas-tarefas` },
    { slug: 'tudo', path: `${ws}/tudo` },
    { slug: 'planner', path: `${ws}/planner` },
    { slug: 'metas', path: `${ws}/metas` },
    { slug: 'meta', path: `${ws}/metas/${goalId}` },
    { slug: 'docs', path: `${ws}/docs` },
    { slug: 'doc', path: `${ws}/docs/${docId}` },
    { slug: 'chat', path: `${ws}/chat` },
    { slug: 'ia', path: `${ws}/ia` },
    { slug: 'whiteboards', path: `${ws}/whiteboards` },
    { slug: 'whiteboard', path: `${ws}/whiteboards/${whiteboardId}` },
    { slug: 'dashboards', path: `${ws}/dashboards` },
    { slug: 'dashboard', path: `${ws}/dashboards/${dashboardId}` },
    { slug: 'automacoes', path: `${ws}/automacoes` },
    { slug: 'timesheets', path: `${ws}/timesheets` },
    { slug: 'arquivados', path: `${ws}/arquivados` },
    { slug: 'lixeira', path: `${ws}/lixeira` },
    { slug: 'space', path: `${ws}/s/${spaceId}` },
    { slug: 'folder', path: `${ws}/f/${folderId}` },
    { slug: 'list', path: `${ws}/l/${listId}` },
    { slug: 'tarefa', path: `${ws}/t/${customId}` },
    { slug: 'config-perfil', path: `${ws}/configuracoes/perfil` },
    { slug: 'config-preferencias', path: `${ws}/configuracoes/preferencias` },
    { slug: 'config-notificacoes', path: `${ws}/configuracoes/notificacoes` },
    { slug: 'config-seguranca', path: `${ws}/configuracoes/seguranca` },
    { slug: 'config-workspace', path: `${ws}/configuracoes/workspace` },
    { slug: 'config-pessoas', path: `${ws}/configuracoes/pessoas` },
    { slug: 'config-equipes', path: `${ws}/configuracoes/equipes` },
    { slug: 'config-clickapps', path: `${ws}/configuracoes/clickapps` },
    { slug: 'config-campos', path: `${ws}/configuracoes/campos` },
    { slug: 'config-integracoes', path: `${ws}/configuracoes/integracoes` },
    { slug: 'config-webhooks', path: `${ws}/configuracoes/webhooks` },
    { slug: 'config-chaves', path: `${ws}/configuracoes/chaves` },
    { slug: 'config-auditoria', path: `${ws}/configuracoes/auditoria` },
    { slug: 'config-dados', path: `${ws}/configuracoes/dados` },
    { slug: 'workspaces', path: '/workspaces' },
  ];

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

/** Falha se a largura do documento passar da janela, e guarda o print. */
async function sweep(target: Page, slug: string, path: string): Promise<void> {
  await target.setViewportSize({ width: SWEEP_WIDTHS[3], height: 900 });
  await target.goto(path);
  await target.waitForLoadState('domcontentloaded');
  await expect(target.locator('#root')).not.toBeEmpty();

  for (const width of SWEEP_WIDTHS) {
    await target.setViewportSize({ width, height: 900 });
    await target.waitForTimeout(350);

    const overflow = await target.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    await target.screenshot({ path: `${SHOTS}/${slug}-${String(width)}.png` });

    expect(
      overflow.scrollWidth,
      `${slug} rolou para os lados em ${String(width)} px (${String(overflow.scrollWidth)} > ${String(overflow.innerWidth)})`,
    ).toBeLessThanOrEqual(overflow.innerWidth);
  }
}

test('todas as rotas do app em 360, 768, 1024 e 1280', async () => {
  test.setTimeout(10 * 60_000);

  for (const route of routes) {
    await sweep(page, route.slug, route.path);
  }
});

test('telas de acesso em 360, 768, 1024 e 1280', async ({ page: anonymous }) => {
  test.setTimeout(3 * 60_000);

  for (const route of [
    { slug: 'login', path: '/login' },
    { slug: 'cadastro', path: '/cadastro' },
  ]) {
    await sweep(anonymous, route.slug, route.path);
  }
});
