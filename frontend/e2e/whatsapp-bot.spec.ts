import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { adminApi, expectNoHorizontalScroll, signInContext, type AdminApi } from './helpers';
import {
  connectWa,
  deliver,
  envelope,
  inboundText,
  resetWaBot,
  waitForBotMessage,
  waitForConversation,
} from './wa-cloud';

/**
 * Abas de bot e configuração da Central (F20). A API de e2e sobe com
 * WHATSAPP_MOCK=true, então o bot responde de verdade sem WABA: a regra é criada
 * pela tela e a resposta é conferida na conversa.
 */
const CONTACTS = {
  regra: '5531988881001',
  atalho: '5531988881002',
  ausencia: '5531988881003',
};

const WELCOME = 'Oi, {nome}! Sou o bot da Azuos.';
const RULE_REPLY = 'Nosso orçamento começa em R$ 2.500.';
const AWAY = 'Nosso atendimento é de segunda a sexta, das 9h às 18h.';

let session: AdminApi;
let wsId = '';

/** Abre a aba pedida da Central já logado e espera o que marca a aba. */
async function openTab(page: Page, tab: string, marker: RegExp | string): Promise<void> {
  await page.goto(`/w/${wsId}/whatsapp?aba=${tab}`);
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
}

/** O painel da conversa aberta, para não confundir com a prévia da lista. */
function conversationPane(page: Page, name: string) {
  return page.getByRole('region', { name: new RegExp(`Conversa com ${name}`) });
}

/** Abre a conversa do contato pela lista de Conversas. */
async function openConversation(page: Page, name: string): Promise<void> {
  await page.goto(`/w/${wsId}/whatsapp?aba=conversas&filtro=all`);
  await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page
    .getByRole('button', { name: new RegExp(name) })
    .first()
    .click();
  await expect(
    page.getByRole('region', { name: new RegExp(`Conversa com ${name}`) }),
  ).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('Central do WhatsApp — bot e configuração', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    session = await adminApi();
    wsId = session.wsId;
    await connectWa(session);

    context = await browser.newContext();
    await signInContext(context);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    // Bot e horário são do workspace: desligados, os outros specs do módulo
    // seguem recebendo mensagem sem resposta automática no meio.
    await resetWaBot(session);
    await context.close();
    await session.dispose();
  });

  test('liga o bot, cria a regra pela tela e vê o bot responder', async () => {
    await openTab(page, 'bot', 'Bot do atendimento');

    await page.getByRole('checkbox', { name: /Bot ligado/ }).check();
    await page.getByRole('textbox', { name: /Boas-vindas/ }).fill(WELCOME);
    await page.getByRole('button', { name: 'Salvar bot' }).click();
    await expect(page.getByText('Bot salvo.')).toBeVisible();

    await openTab(page, 'regras', 'Nenhuma regra ainda');
    await page.getByRole('button', { name: 'Nova regra' }).click();

    await expect(page.getByText('Nova regra do bot')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nome da regra' }).fill('Preço e orçamento');
    await page.getByLabel('Dispara quando').selectOption('keyword');
    await page.getByRole('textbox', { name: 'Valor', exact: true }).fill('orcamento');
    await page.getByRole('textbox', { name: 'Mensagem' }).fill(RULE_REPLY);

    // A prévia mostra a bolha como o cliente vai receber, antes de salvar.
    await expect(page.getByLabel('Prévia da resposta').getByText(RULE_REPLY)).toBeVisible();

    await page.getByRole('button', { name: 'Salvar regra' }).click();
    await expect(page.getByText('Regra salva.')).toBeVisible();
    await expect(page.getByText('Palavra exata: "orcamento" → Texto')).toBeVisible();

    // A primeira mensagem cai nas boas-vindas; a segunda casa com a regra.
    await deliver(
      session,
      envelope(
        inboundText({
          id: `wamid.f20.regra.1.${String(Date.now())}`,
          from: CONTACTS.regra,
          name: 'Caio do Bot',
          body: 'oi',
        }),
      ),
    );

    const conversation = await waitForConversation(session, CONTACTS.regra);

    await waitForBotMessage(session, conversation.id, 'Oi, Caio do Bot!');

    await deliver(
      session,
      envelope(
        inboundText({
          id: `wamid.f20.regra.2.${String(Date.now())}`,
          from: CONTACTS.regra,
          name: 'Caio do Bot',
          body: 'quero um orcamento',
        }),
      ),
    );

    await waitForBotMessage(session, conversation.id, RULE_REPLY);

    await openConversation(page, 'Caio do Bot');
    // Dentro da conversa: a prévia da lista mostra o mesmo texto.
    await expect(conversationPane(page, 'Caio do Bot').getByText(RULE_REPLY)).toBeVisible();
  });

  test('cadastra a resposta rápida e usa pelo "/" na conversa', async () => {
    await openTab(page, 'respostas', 'Nenhuma resposta rápida');
    await page.getByRole('button', { name: 'Nova resposta' }).click();

    await expect(page.getByText('Nova resposta rápida')).toBeVisible();
    await page.getByRole('textbox', { name: 'Atalho' }).fill('tabela');
    await page.getByRole('textbox', { name: 'Título' }).fill('Tabela de preços');
    await page
      .getByRole('textbox', { name: 'Texto' })
      .fill('Oi, {nome}! A tabela começa em R$ 2.500.');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();

    await expect(page.getByText('Resposta rápida salva.')).toBeVisible();
    await expect(page.getByText('/tabela')).toBeVisible();

    await deliver(
      session,
      envelope(
        inboundText({
          id: `wamid.f20.atalho.${String(Date.now())}`,
          from: CONTACTS.atalho,
          name: 'Bia do Atalho',
          body: 'bom dia',
        }),
      ),
    );

    await waitForConversation(session, CONTACTS.atalho);
    await openConversation(page, 'Bia do Atalho');

    const field = page.getByRole('textbox', { name: 'Mensagem' });

    await field.fill('/tabela');
    await page.getByRole('button', { name: /\/tabela · Tabela de preços/ }).click();

    // A lista do "/" já vem com as variáveis resolvidas pela conversa.
    await expect(field).toHaveValue('Oi, Bia do Atalho! A tabela começa em R$ 2.500.');

    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(page.getByText('Oi, Bia do Atalho! A tabela começa em R$ 2.500.')).toBeVisible();
  });

  test('horário fora do atendimento responde com a mensagem de ausência', async () => {
    await openTab(page, 'horarios', 'Horário de atendimento');

    await page.getByRole('checkbox', { name: /Horário ligado/ }).check();
    await page.getByRole('textbox', { name: /Texto/ }).fill(AWAY);
    await page.getByRole('button', { name: 'Salvar horários' }).click();
    await expect(page.getByText('Horários salvos.')).toBeVisible();

    // Nenhum dia tem faixa: o atendimento está fechado a qualquer hora.
    await deliver(
      session,
      envelope(
        inboundText({
          id: `wamid.f20.ausencia.${String(Date.now())}`,
          from: CONTACTS.ausencia,
          name: 'Davi de Fora',
          body: 'vocês atendem agora?',
        }),
      ),
    );

    const conversation = await waitForConversation(session, CONTACTS.ausencia);

    await waitForBotMessage(session, conversation.id, AWAY);

    await openConversation(page, 'Davi de Fora');
    await expect(
      page.getByRole('region', { name: /Conversa com Davi de Fora/ }).getByText(AWAY),
    ).toBeVisible();
  });

  test('as abas novas não rolam para os lados em 360, 768 e 1280', async () => {
    const tabs = [
      { id: 'visao-geral', heading: /Conversas/ },
      { id: 'regras', heading: /Preço e orçamento|Nenhuma regra/ },
      { id: 'bot', heading: /Bot do atendimento/ },
      { id: 'respostas', heading: /Tabela de preços|Nenhuma resposta/ },
      { id: 'horarios', heading: /Horário de atendimento/ },
    ];

    for (const tab of tabs) {
      await page.goto(`/w/${wsId}/whatsapp?aba=${tab.id}`);
      await expect(page.getByText(tab.heading).first()).toBeVisible({ timeout: 20_000 });
      await expectNoHorizontalScroll(page);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
  });
});
