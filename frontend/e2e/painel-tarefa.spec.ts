import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createResource,
  expectNoHorizontalScroll,
  signInContext,
  type AdminApi,
} from './helpers';

/**
 * Painel da tarefa (F7). Uma sessão só para o arquivo e um Space próprio: o que
 * os outros specs conferem na hierarquia do seed fica intocado.
 */
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const SPACE = `F7 Painel ${stamp}`;
const LIST = `Painel ${stamp}`;
const TASK = `Fechar caixa offline ${stamp}`;
const SUBTASK = `Sincronizar fila ${stamp}`;
const CHECKLIST = `Conferência ${stamp}`;
const CHECK_ITEM = `Testar impressora ${stamp}`;
const TAG = `offline-${stamp}`;

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  priority: string | null;
  points: number | null;
  estimateMinutes: number | null;
  type: string;
  descriptionText: string;
  trackedMinutes: number;
  archivedAt: string | null;
  tagIds: string[];
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
let task: TaskBody;

async function readTask(customId: string): Promise<TaskBody> {
  const response = await session.api.get(`${API_URL}/workspaces/${wsId}/tasks/${customId}`, {
    headers: session.headers,
  });

  expect(response.ok(), `leitura de ${customId}`).toBeTruthy();

  return (await response.json()) as TaskBody;
}

/** Abre o painel pelo link direto e espera o nome carregado. */
async function openPanel(width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/w/${wsId}/t/${task.customId}`);
  await expect(page.getByLabel('Nome da tarefa')).toHaveValue(task.name, { timeout: 15_000 });
}

test.beforeAll(async ({ browser }) => {
  session = await adminApi();
  wsId = session.wsId;

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

  const created = await session.api.post(`${API_URL}/workspaces/${wsId}/lists/${listId}/tasks`, {
    headers: session.headers,
    data: { name: TASK },
  });

  expect(created.ok(), 'criação da tarefa do painel').toBeTruthy();
  task = (await created.json()) as TaskBody;

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
});

test('o link direto abre o painel sobre a view da List', async () => {
  await openPanel();

  await expect(page.getByRole('complementary', { name: 'Detalhes da tarefa' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();
  await expect(page.getByRole('button', { name: `Copiar link de ${task.customId}` })).toBeVisible();
});

test('edita nome, prioridade, pontos, estimativa e tipo, e os campos voltam no reload', async () => {
  await openPanel();

  const renamed = `${TASK} revisado`;

  await page.getByLabel('Nome da tarefa').fill(renamed);
  await expect
    .poll(async () => (await readTask(task.customId)).name, { timeout: 15_000 })
    .toBe(renamed);

  await page.getByRole('button', { name: 'Escolher prioridade' }).click();
  await page.getByRole('button', { name: 'Alta', exact: true }).click();

  await page.getByLabel('Pontos').fill('8');
  await page.getByLabel('Pontos').press('Enter');

  await page.getByLabel('Estimativa').fill('1h30');
  await page.getByLabel('Estimativa').press('Enter');

  await page.getByLabel('Tipo da tarefa').selectOption('bug');

  await expect
    .poll(
      async () => {
        const fresh = await readTask(task.customId);

        return [fresh.priority, fresh.points, fresh.estimateMinutes, fresh.type].join('|');
      },
      { timeout: 15_000 },
    )
    .toBe('high|8|90|bug');

  await page.reload();

  await expect(page.getByLabel('Nome da tarefa')).toHaveValue(renamed);
  await expect(page.getByRole('button', { name: 'Escolher prioridade' })).toContainText('Alta');
  await expect(page.getByLabel('Pontos')).toHaveValue('8');
  await expect(page.getByLabel('Estimativa')).toHaveValue('1h30min');
  await expect(page.getByLabel('Tipo da tarefa')).toHaveValue('bug');

  task = await readTask(task.customId);
});

test('cria a tag na hora e ela fica na tarefa', async () => {
  await openPanel();

  await page.getByRole('button', { name: 'Escolher tags' }).click();
  await page.getByLabel('Nova tag').fill(TAG);
  await page.getByRole('button', { name: 'Criar tag' }).click();

  await expect
    .poll(async () => (await readTask(task.customId)).tagIds.length, { timeout: 15_000 })
    .toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Escolher tags' })).toContainText(TAG);
});

test('a descrição salva sozinha e mostra "Salvo"', async () => {
  await openPanel();

  const text = `Abrir e fechar o caixa sem internet ${stamp}`;

  await page.getByRole('textbox', { name: 'Descrição da tarefa' }).click();
  await page.keyboard.type(text);

  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => (await readTask(task.customId)).descriptionText, { timeout: 15_000 })
    .toContain(text);

  await page.reload();

  await expect(page.getByRole('textbox', { name: 'Descrição da tarefa' })).toContainText(text);
});

test('a barra de formatação liga o negrito da descrição', async () => {
  await openPanel();

  // Cada editor tem a barra com o próprio nome: a do comentário também existe.
  const toolbar = page.getByRole('toolbar', { name: 'Formatação: Descrição da tarefa' });

  await page.getByRole('textbox', { name: 'Descrição da tarefa' }).click();
  await toolbar.getByRole('button', { name: 'Negrito' }).click();

  await expect(toolbar.getByRole('button', { name: 'Negrito' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('cria subtarefa e ela abre no painel', async () => {
  await openPanel();

  await page.getByLabel('Nova subtarefa').fill(SUBTASK);
  await page.getByRole('button', { name: 'Criar subtarefa' }).click();

  const link = page.getByRole('link', { name: SUBTASK });

  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();

  await expect(page.getByLabel('Nome da tarefa')).toHaveValue(SUBTASK, { timeout: 15_000 });
});

test('checklist: cria, marca o item e a barra de progresso chega a 100%', async () => {
  await openPanel();

  await page.getByLabel('Nova checklist').fill(CHECKLIST);
  await page.getByRole('button', { name: 'Criar checklist' }).click();

  await expect(page.getByRole('heading', { level: 3, name: CHECKLIST })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel(`Novo item em ${CHECKLIST}`).fill(CHECK_ITEM);
  await page.getByRole('button', { name: `Adicionar item em ${CHECKLIST}` }).click();

  const box = page.getByRole('checkbox', { name: CHECK_ITEM });

  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.click();

  await expect(
    page.getByRole('progressbar', { name: `Progresso de ${CHECKLIST}` }),
  ).toHaveAttribute('aria-valuenow', '100', { timeout: 15_000 });
});

test('o cronômetro aparece na topbar e para por lá', async () => {
  await openPanel();

  await page.getByRole('button', { name: 'Iniciar cronômetro' }).click();

  const topbarTimer = page.getByRole('timer', { name: /Cronômetro em andamento/ });

  await expect(topbarTimer).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Parar cronômetro' }).click();

  await expect(topbarTimer).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Iniciar cronômetro' })).toBeVisible();
});

test('lança tempo manual e o total sobe', async () => {
  await openPanel();

  await page.getByLabel('Duração').fill('45min');
  await page.getByRole('button', { name: 'Lançar tempo' }).click();

  await expect
    .poll(async () => (await readTask(task.customId)).trackedMinutes, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(45);

  await expect(page.getByRole('list').filter({ hasText: '45min' }).first()).toBeVisible();
});

test('conclui a tarefa e depois reabre', async () => {
  await openPanel();

  const doneName = statuses.find((status) => status.group === 'done')?.name ?? '';

  expect(doneName, 'status do grupo concluído').not.toBe('');

  await page.getByRole('button', { name: 'Concluir' }).click();

  await expect(page.getByRole('button', { name: 'Reabrir' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Trocar o status da tarefa' })).toContainText(
    doneName,
  );

  await page.getByRole('button', { name: 'Reabrir' }).click();

  await expect(page.getByRole('button', { name: 'Concluir' })).toBeVisible({ timeout: 15_000 });
});

test('seguir e deixar de seguir a tarefa', async () => {
  await openPanel();

  await page.getByRole('button', { name: 'Seguir' }).click();

  const following = page.getByRole('button', { name: 'Seguindo' });

  await expect(following).toBeVisible({ timeout: 15_000 });
  await following.click();

  await expect(page.getByRole('button', { name: 'Seguir' })).toBeVisible({ timeout: 15_000 });
});

test('os modos do painel trocam entre lateral, modal e tela cheia', async () => {
  await openPanel();

  await page.getByRole('button', { name: 'Modal' }).click();
  await expect(page.getByRole('dialog', { name: 'Detalhes da tarefa' })).toBeVisible();

  await page.getByRole('button', { name: 'Tela cheia' }).click();
  await expect(page.locator('[data-task-panel="full"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeHidden();

  await page.getByRole('button', { name: 'Painel lateral' }).click();
  await expect(page.getByRole('complementary', { name: 'Detalhes da tarefa' })).toBeVisible();
});

test('Esc fecha o painel e volta para a List', async () => {
  await openPanel();

  await page.getByLabel('Nome da tarefa').press('Escape');

  await page.waitForURL(new RegExp(`/w/${wsId}/l/${listId}$`), { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: LIST })).toBeVisible();
});

test('no celular o painel é tela cheia e volta pelo botão', async () => {
  await openPanel(360);

  await expect(page.locator('[data-task-panel="full"]')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Detalhes da tarefa' })).toBeHidden();

  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.waitForURL(new RegExp(`/w/${wsId}/l/${listId}$`), { timeout: 15_000 });
});

test('o painel não rola para os lados em 360, 768 e 1280', async () => {
  await openPanel();
  await expectNoHorizontalScroll(page);
});

test('arquiva a tarefa pelo menu e ela sai das views', async () => {
  await openPanel();

  await page.getByRole('button', { name: `Ações de ${task.customId}` }).click();
  await page.getByRole('menuitem', { name: 'Arquivar' }).click();
  await page.getByRole('button', { name: 'Arquivar' }).last().click();

  await page.waitForURL(new RegExp(`/w/${wsId}/l/${listId}$`), { timeout: 15_000 });

  await expect
    .poll(async () => (await readTask(task.customId)).archivedAt, { timeout: 15_000 })
    .not.toBeNull();

  await expect(page.getByRole('link', { name: task.name })).toBeHidden();
});
