import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import {
  adminApi,
  createResource,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  seedWorkspaceId,
  signInContext,
  type AdminApi,
  type Credentials,
} from './helpers';

/**
 * Abas avançadas de Configurações (F16). Uma sessão de admin para o arquivo
 * inteiro, como nas outras telas: o login tem limite por IP.
 */
let page: Page;
let wsId: string;
let session: AdminApi;
let spaceId: string;

/** Destino de verdade dos webhooks: o backend fala com este servidor local. */
let hookServer: Server;
let hookUrl: string;
let received: string[] = [];

test.describe.configure({ mode: 'serial' });

function settingsUrl(tab: string): string {
  return `/w/${wsId}/configuracoes/${tab}`;
}

test.beforeAll(async ({ browser }) => {
  wsId = await seedWorkspaceId();
  session = await adminApi();
  spaceId = await createResource(session, 'spaces', { name: `Avançado ${String(Date.now())}` });

  hookServer = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push(Buffer.concat(chunks).toString('utf8'));
      response.writeHead(200).end('ok');
    });
  });

  await new Promise<void>((done) => {
    hookServer.listen(0, '127.0.0.1', done);
  });

  hookUrl = `http://127.0.0.1:${String((hookServer.address() as AddressInfo).port)}/hook`;

  const context = await browser.newContext();

  await signInContext(context);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
  await session.dispose();
  await new Promise<void>((done) => {
    hookServer.close(() => {
      done();
    });
  });
});

test.beforeEach(async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('a chave de API nasce visível uma vez e a revogação encerra', async () => {
  await page.goto(settingsUrl('chaves'));
  await expect(page.getByRole('heading', { name: 'Chaves de API', level: 1 })).toBeVisible();

  const name = `Chave ${String(Date.now())}`;

  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Escopo').selectOption('write');
  await page.getByRole('button', { name: 'Criar chave' }).click();

  const notice = page.getByRole('status', { name: 'Sua chave' });

  await expect(notice).toBeVisible();
  await expect(notice.getByText(/^azk_/)).toBeVisible();

  const keys = page.getByRole('list', { name: 'Chaves de API' });

  await expect(keys.getByText(name)).toBeVisible();
  await expect(keys.getByText('Ativa')).toBeVisible();

  // Recarregar não mostra a chave de novo: só o hash fica no servidor.
  await page.reload();
  await expect(page.getByRole('status', { name: 'Sua chave' })).toBeHidden();
  await expect(page.getByText(/^azk_/)).toHaveCount(0);

  await page.getByRole('button', { name: `Revogar ${name}` }).click();
  await page.getByRole('button', { name: 'Revogar', exact: true }).click();

  await expect(keys.getByText('Revogada')).toBeVisible();
  await expect(page.getByRole('button', { name: `Revogar ${name}` })).toBeHidden();
});

test('o webhook de saída entrega o evento e o log reenvia', async () => {
  received = [];

  await page.goto(settingsUrl('webhooks'));
  await expect(page.getByRole('heading', { name: 'Webhooks', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Novo webhook' }).click();
  await page.getByLabel('URL de destino').fill(hookUrl);
  await page.getByRole('button', { name: 'Criar webhook' }).click();

  await expect(page.getByRole('status', { name: 'Secret do webhook' })).toBeVisible();
  await expect(page.getByText(hookUrl)).toBeVisible();

  // O evento sai de uma tarefa criada pela API, como em qualquer escrita.
  const listId = await createResource(session, 'lists', {
    spaceId,
    name: `Entregas ${String(Date.now())}`,
  });

  await createResource(session, `lists/${listId}/tasks`, { name: 'Tarefa do webhook' });

  await page.getByRole('button', { name: `Ver entregas de ${hookUrl}` }).click();

  const log = page.getByRole('list', { name: 'Entregas do webhook' });

  await expect(log.getByText('Tarefa criada')).toBeVisible();
  await expect(log.getByText('Entregue')).toBeVisible();
  expect(received.length).toBeGreaterThan(0);

  const delivered = received.length;

  await log.getByRole('button', { name: 'Reenviar' }).first().click();

  await expect(log.getByText('Entregue')).toHaveCount(2);
  await expect
    .poll(() => received.length, { message: 'o reenvio chega no destino' })
    .toBeGreaterThan(delivered);
});

test('o CSV do ClickUp mostra a prévia e importa', async () => {
  await page.goto(settingsUrl('dados'));
  await expect(page.getByRole('heading', { name: 'Importar e exportar', level: 1 })).toBeVisible();

  const csv = [
    'Task Name,Status,Assignees,Tags,List Name,Folder Name',
    'Trocar o roteador,Aberto,admin@azuos.dev,infra,Suporte,Operação',
    'Revisar proposta,Aberto,ninguem@fora.dev,comercial,Suporte,Operação',
    ',Aberto,,,Suporte,Operação',
  ].join('\n');

  await page.getByLabel('Arquivo CSV').setInputFiles({
    name: 'clickup.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  const preview = page.getByRole('group', { name: 'Prévia do mapeamento' });

  await expect(preview.getByText('Prévia: 3 linhas')).toBeVisible();
  await expect(preview.getByText('Lists: Suporte')).toBeVisible();
  await expect(preview.getByText('Statuses: Aberto')).toBeVisible();
  await expect(preview.getByText(/Responsáveis por e-mail: admin@azuos\.dev/)).toBeVisible();
  await expect(preview.getByText(/1 linha\(s\) serão ignoradas: linha 4/)).toBeVisible();

  await page.getByLabel('Space que recebe').selectOption(spaceId);
  await page.getByRole('button', { name: 'Importar' }).click();

  const report = page.getByRole('status', { name: 'Relatório da importação' });

  await expect(report.getByText('2 tarefas')).toBeVisible();
  await expect(report.getByText('1 ignoradas')).toBeVisible();
  await expect(report.getByText('Linha 4: LINHA SEM NOME DE TAREFA')).toBeVisible();
});

test('ClickApps: desligar no workspace e herdar no Space', async () => {
  await page.goto(settingsUrl('clickapps'));
  await expect(page.getByRole('heading', { name: 'ClickApps', level: 1 })).toBeVisible();

  const sprints = page.getByRole('switch', { name: 'Sprints' });

  await expect(sprints).toHaveAttribute('aria-checked', 'true');
  await sprints.click();
  await expect(sprints).toHaveAttribute('aria-checked', 'false');

  await page.getByLabel('Escopo').selectOption(spaceId);

  const spaceSprints = page.getByLabel('Sprints');

  await expect(spaceSprints).toHaveValue('inherit');
  await expect(page.getByText('Herdado do workspace: desligado')).toBeVisible();

  await spaceSprints.selectOption('on');
  await expect(page.getByText(/Este Space decide 1 de 9 ClickApps/)).toBeVisible();

  // Devolve o workspace ao estado do seed para as outras telas.
  await page.getByLabel('Escopo').selectOption('workspace');
  await page.getByRole('switch', { name: 'Sprints' }).click();
  await expect(page.getByRole('switch', { name: 'Sprints' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('Integrações: liga o repositório do GitHub e mostra o Google', async () => {
  await page.goto(settingsUrl('integracoes'));
  await expect(page.getByRole('heading', { name: 'Integrações', level: 1 })).toBeVisible();

  await expect(page.getByLabel('URL do webhook')).toHaveValue(
    /\/api\/v1\/integrations\/github\/webhook$/,
  );

  const repository = `azuosdev/env-${String(Date.now())}`;

  await page.getByLabel('Repositório').fill(repository);
  await page.getByRole('button', { name: 'Ligar repositório' }).click();

  await expect(page.getByRole('status', { name: 'Secret do webhook' })).toBeVisible();
  await expect(page.getByText(repository, { exact: true })).toBeVisible();

  // Sem GOOGLE_CLIENT_ID no servidor a conta não pode ser conectada.
  await expect(page.getByText('Indisponível')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conectar Google Agenda' })).toBeDisabled();

  await page.getByRole('button', { name: `Desligar ${repository}` }).click();
  await page.getByRole('button', { name: 'Desligar', exact: true }).click();

  await expect(page.getByRole('button', { name: `Desligar ${repository}` })).toBeHidden();
  await expect(page.getByText(repository, { exact: true })).toBeHidden();
});

test('a auditoria lista a ação do admin e filtra', async () => {
  await page.goto(settingsUrl('auditoria'));
  await expect(page.getByRole('heading', { name: 'Auditoria', level: 1 })).toBeVisible();

  const log = page.getByRole('list', { name: 'Ações de administração' });

  await expect(log.getByText('Repositório ligado').first()).toBeVisible();

  await page.getByLabel('Ação', { exact: true }).selectOption('webhook.created');
  await expect(log.getByText('Webhook criado').first()).toBeVisible();
  await expect(log.getByText('Repositório ligado')).toHaveCount(0);
});

test('Campos personalizados mostra onde cada campo vale', async () => {
  const listId = await createResource(session, 'lists', {
    spaceId,
    name: `Campos ${String(Date.now())}`,
  });

  await createResource(session, 'custom-fields', {
    scope: 'list',
    scopeId: listId,
    name: 'Contrato',
    type: 'text',
  });

  await page.goto(settingsUrl('campos'));
  await expect(
    page.getByRole('heading', { name: 'Campos personalizados', level: 1 }),
  ).toBeVisible();

  await page.getByLabel('Local').selectOption(`list:${listId}`);

  await expect(page.getByText('Contrato')).toBeVisible();
  await expect(page.getByText('Deste local')).toBeVisible();
  await expect(page.getByText(/Texto .* definido em List Campos/)).toBeVisible();
});

test('member não vê nenhuma aba avançada', async ({ browser }) => {
  const member: Credentials = await createWorkspaceMember('membro-avancado');
  const context = await browser.newContext();

  await signInContext(context, member);

  const memberPage = await context.newPage();

  await memberPage.goto(`/w/${wsId}/configuracoes`);

  const nav = memberPage.getByRole('navigation', { name: 'Seções de configuração' });

  for (const label of [
    'ClickApps',
    'Campos personalizados',
    'Integrações',
    'Webhooks',
    'Chaves de API',
    'Auditoria',
    'Importar e exportar',
  ]) {
    await expect(nav.getByRole('link', { name: label })).toBeHidden();
  }

  // Pela URL também não entra.
  for (const tab of [
    'clickapps',
    'campos',
    'integracoes',
    'webhooks',
    'chaves',
    'auditoria',
    'dados',
  ]) {
    await memberPage.goto(settingsUrl(tab));
    await expect(memberPage).toHaveURL(new RegExp(`/w/${wsId}/configuracoes$`));
  }

  await context.close();
});

test('cada aba nova não rola para os lados em 360, 768 e 1280', async () => {
  for (const tab of [
    'clickapps',
    'campos',
    'integracoes',
    'webhooks',
    'chaves',
    'auditoria',
    'dados',
  ]) {
    await page.goto(settingsUrl(tab));
    await expectNoHorizontalScroll(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
});
