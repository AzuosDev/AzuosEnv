import { expect, test, type Page } from '@playwright/test';
import {
  createInvite,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  seedWorkspaceId,
  signInContext,
  uniqueEmail,
  type Credentials,
} from './helpers';

/**
 * Uma sessão de admin para todo o arquivo. A sessão entra pela API e o cookie é
 * injetado no contexto: o login tem limite de 5 por minuto por IP e o navegador
 * sempre sai do mesmo IP.
 */
let page: Page;
let wsId: string;

test.describe.configure({ mode: 'serial' });

const STRONG_PASSWORD = 'Azuos2026';

function settingsUrl(tab = ''): string {
  return `/w/${wsId}/configuracoes${tab ? `/${tab}` : ''}`;
}

test.beforeAll(async ({ browser }) => {
  wsId = await seedWorkspaceId();

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

test('a lista de seções leva para cada aba', async () => {
  await page.goto(settingsUrl());

  await expect(page.getByRole('heading', { name: 'Configurações', level: 1 })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Seções de configuração' });

  await nav.getByRole('link', { name: 'Perfil' }).click();
  await expect(page).toHaveURL(/configuracoes\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Perfil', level: 1 })).toBeVisible();

  await nav.getByRole('link', { name: 'Notificações' }).click();
  await expect(page).toHaveURL(/configuracoes\/notificacoes$/);
  await expect(page.getByRole('heading', { name: 'Notificações', level: 1 })).toBeVisible();
});

test('o perfil salva avatar, fuso e idioma', async () => {
  await page.goto(settingsUrl('perfil'));

  const avatar = page.getByLabel('URL do avatar');

  await avatar.fill('https://cdn.azuos.dev/avatars/felipe.png');
  await page.getByLabel('Fuso horário').selectOption('America/Sao_Paulo');
  await page.getByLabel('Idioma').selectOption('pt-BR');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();

  await expect(page.getByText('Perfil salvo.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('URL do avatar')).toHaveValue(
    'https://cdn.azuos.dev/avatars/felipe.png',
  );
  await expect(page.getByLabel('Fuso horário')).toHaveValue('America/Sao_Paulo');

  // Volta às iniciais: a URL vazia remove o avatar.
  await page.getByLabel('URL do avatar').fill('');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByText('Perfil salvo.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('URL do avatar')).toHaveValue('');
});

test('o tema escolhido vale na hora e vence o localStorage no login seguinte', async ({
  browser,
}) => {
  await page.goto(settingsUrl('preferencias'));

  await page.getByRole('radio', { name: 'Claro' }).click();
  await expect(page.getByText('Tema salvo na sua conta.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Sessão nova com o tema escuro gravado no navegador: o servidor vence.
  const context = await browser.newContext();

  await context.addInitScript(() => {
    window.localStorage.setItem('azuos-env:theme', 'dark');
  });
  await signInContext(context);

  const fresh = await context.newPage();

  await fresh.goto(settingsUrl('preferencias'));
  await expect(fresh.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(fresh.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');
  await context.close();

  // Devolve o padrão do produto para as próximas telas.
  await page.getByRole('radio', { name: 'Escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a matriz de notificações guarda o canal escolhido', async () => {
  await page.goto(settingsUrl('notificacoes'));

  const name = 'Mudança de status — E-mail';
  const cell = page.getByRole('checkbox', { name });
  const before = await cell.isChecked();

  await cell.click();
  await expect(cell).toBeChecked({ checked: !before });

  await page.reload();
  await expect(page.getByRole('checkbox', { name })).toBeChecked({ checked: !before });
});

test('segurança lista as sessões e encerra uma delas', async ({ browser }) => {
  // Uma segunda sessão da mesma conta, aberta direto na API.
  const other = await browser.newContext();

  await signInContext(other);

  await page.goto(settingsUrl('seguranca'));

  await expect(page.getByLabel('Senha atual')).toBeVisible();
  await expect(page.getByText('Esta sessão')).toBeVisible();

  const encerrar = page.getByRole('button', { name: 'Encerrar', exact: true });

  await expect(encerrar.first()).toBeVisible();

  const before = await encerrar.count();

  await encerrar.first().click();
  await expect(page.getByText('Sessão encerrada.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Encerrar', exact: true })).toHaveCount(before - 1);

  await other.close();
});

test('o workspace salva nome e prefixo das tarefas', async () => {
  await page.goto(settingsUrl('workspace'));

  await page.getByLabel('Nome do workspace').fill('Azuos Dev QA');
  await page.getByLabel('Prefixo das tarefas').fill('AZQ');
  await page.getByRole('button', { name: 'Salvar workspace' }).click();

  await expect(page.getByText('Workspace salvo.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Nome do workspace')).toHaveValue('Azuos Dev QA');

  // Devolve o nome do seed: as outras telas contam com ele.
  await page.getByLabel('Nome do workspace').fill('Azuos Dev');
  await page.getByLabel('Prefixo das tarefas').fill('AZD');
  await page.getByRole('button', { name: 'Salvar workspace' }).click();
  await expect(page.getByText('Workspace salvo.')).toBeVisible();
});

test('convidar pela tela lista o convite e cancelar o remove', async () => {
  const email = uniqueEmail('convite-tela');

  await page.goto(settingsUrl('pessoas'));

  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Papel', { exact: true }).selectOption('member');
  await page.getByRole('button', { name: 'Convidar' }).click();

  await expect(page.getByText(`Convite enviado para ${email}.`)).toBeVisible();

  const pendentes = page.getByRole('region', { name: 'Convites pendentes' });

  await expect(pendentes.getByText(email)).toBeVisible();

  await pendentes.getByRole('button', { name: `Cancelar convite de ${email}` }).click();
  await expect(page.getByText('Convite cancelado.')).toBeVisible();
  await expect(pendentes.getByText(email)).toBeHidden();
});

test('o convite aceito em outro contexto aparece em Pessoas', async ({ browser }) => {
  const email = uniqueEmail('convidado-config');
  const token = await createInvite(email);
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();

  await guestPage.goto(`/convite/${token}`);
  await guestPage.getByLabel('Nome completo').fill('Convidada Config');
  await guestPage.getByLabel('Senha', { exact: true }).fill(STRONG_PASSWORD);
  await guestPage.getByRole('button', { name: 'Aceitar convite' }).click();

  await expect(guestPage).toHaveURL(/\/login$/);
  await guest.close();

  await page.goto(settingsUrl('pessoas'));

  const pessoas = page.getByRole('region', { name: 'Quem participa' });

  await expect(pessoas.getByText(email)).toBeVisible();
  await expect(pessoas.getByLabel('Papel de Convidada Config')).toHaveValue('member');
});

test('equipes: criar, editar e remover', async () => {
  await page.goto(settingsUrl('equipes'));

  await page.getByRole('button', { name: 'Nova equipe' }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Nome da equipe').fill('Squad Produto');
  await dialog.getByRole('checkbox').first().click();
  await dialog.getByRole('button', { name: 'Salvar equipe' }).click();

  await expect(page.getByText('Equipe criada.')).toBeVisible();
  await expect(page.getByText('Squad Produto')).toBeVisible();

  await page.getByRole('button', { name: 'Editar Squad Produto' }).click();
  await page.getByRole('dialog').getByLabel('Nome da equipe').fill('Squad Plataforma');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar equipe' }).click();

  await expect(page.getByText('Equipe atualizada.')).toBeVisible();
  await expect(page.getByText('Squad Plataforma')).toBeVisible();

  await page.getByRole('button', { name: 'Remover Squad Plataforma' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();

  await expect(page.getByText('Equipe removida.')).toBeVisible();
  await expect(page.getByText('Squad Plataforma')).toBeHidden();
});

test('member não vê as abas nem as ações de admin', async ({ browser }) => {
  const member: Credentials = await createWorkspaceMember('membro-config');
  const context = await browser.newContext();

  await signInContext(context, member);

  const memberPage = await context.newPage();

  await memberPage.goto(settingsUrl());

  const nav = memberPage.getByRole('navigation', { name: 'Seções de configuração' });

  await expect(nav.getByRole('link', { name: 'Perfil' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Equipes' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Workspace' })).toBeHidden();
  await expect(nav.getByRole('link', { name: 'Pessoas' })).toBeHidden();

  // Pela URL também não entra.
  await memberPage.goto(settingsUrl('pessoas'));
  await expect(memberPage).toHaveURL(new RegExp(`${settingsUrl()}$`));

  await memberPage.goto(settingsUrl('equipes'));
  await expect(memberPage.getByRole('heading', { name: 'Equipes', level: 1 })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'Nova equipe' })).toBeHidden();

  await context.close();
});

test('cada aba não rola para os lados em 360, 768 e 1280', async () => {
  for (const tab of [
    '',
    'perfil',
    'preferencias',
    'notificacoes',
    'seguranca',
    'workspace',
    'pessoas',
    'equipes',
  ]) {
    await page.goto(settingsUrl(tab));
    await expectNoHorizontalScroll(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
});
