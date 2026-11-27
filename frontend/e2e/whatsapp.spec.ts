import { createHmac } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  API_URL,
  adminApi,
  createWorkspaceMember,
  expectNoHorizontalScroll,
  nextIp,
  setTheme,
  signInContext,
  type AdminApi,
  type Credentials,
} from './helpers';

/**
 * Central do WhatsApp (F19). A API de e2e sobe com WHATSAPP_MOCK=true, então a
 * Cloud API é a falsa: a conversa entra pelo webhook público, assinado com o
 * App Secret que este arquivo mesmo cadastra, e o envio nunca sai do processo.
 */
const PHONE_NUMBER_ID = '55590001';
const WABA_ID = '555000';
const APP_SECRET = 'segredo-do-app-do-e2e';
const VERIFY_TOKEN = 'verify-token-do-e2e';

/** Um número por cenário: a conversa aberta é única por contato. */
const CONTACTS = {
  responder: '5531988880001',
  midia: '5531988880002',
  template: '5531988880003',
  fila: '5531988880004',
  outra: '5531988880005',
};

let session: AdminApi;
let wsId = '';
let browser: Browser;

/** Contexto novo já logado como a pessoa pedida. */
async function contextFor(user: Credentials): Promise<BrowserContext> {
  const next = await browser.newContext();

  await signInContext(next, user);

  return next;
}

/** Cadastra a conexão da WABA no workspace do seed. */
async function connect(): Promise<void> {
  const response = await session.api.put(`${API_URL}/workspaces/${wsId}/whatsapp/connection`, {
    headers: session.headers,
    data: {
      provider: 'cloud',
      phoneNumberId: PHONE_NUMBER_ID,
      wabaId: WABA_ID,
      accessToken: 'token-da-graph-do-e2e',
      appSecret: APP_SECRET,
      verifyToken: VERIFY_TOKEN,
    },
  });

  expect(response.ok(), 'conexão do WhatsApp cadastrada').toBeTruthy();

  // O save deixa a conexão pendente; é o teste que confirma o número na Graph
  // (aqui, a falsa do WHATSAPP_MOCK) e marca a conexão como conectada.
  const tested = await session.api.post(`${API_URL}/workspaces/${wsId}/whatsapp/connection/test`, {
    headers: session.headers,
  });

  expect(
    tested.ok(),
    'teste da conexão: a API de e2e precisa da Cloud API falsa (WHATSAPP_MOCK=true)',
  ).toBeTruthy();
}

/** Envelope da Cloud API com um `changes[].value`. */
function envelope(value: Record<string, unknown>): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5531900000000',
                phone_number_id: PHONE_NUMBER_ID,
              },
              ...value,
            },
          },
        ],
      },
    ],
  });
}

function inboundText(options: {
  id: string;
  from: string;
  name: string;
  body: string;
  secondsAgo?: number;
}): Record<string, unknown> {
  return {
    contacts: [{ wa_id: options.from, profile: { name: options.name } }],
    messages: [
      {
        id: options.id,
        from: options.from,
        timestamp: String(Math.floor((Date.now() - (options.secondsAgo ?? 30) * 1000) / 1000)),
        type: 'text',
        text: { body: options.body },
      },
    ],
  };
}

/** Entrega o evento assinado no webhook público, como a Meta faria. */
async function deliver(body: string): Promise<void> {
  const signature = `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;
  const response = await session.api.post(`${API_URL}/integrations/whatsapp/webhook`, {
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signature,
      'X-Forwarded-For': nextIp(),
    },
    data: body,
  });

  expect(response.status(), 'webhook aceito').toBe(200);
}

interface ConversationRow {
  id: string;
  contact: { waId: string } | null;
}

/**
 * Espera a conversa do número aparecer na API. O webhook responde 200 na hora e
 * processa depois, então o cenário só continua quando a fila terminou.
 */
async function waitForConversation(waId: string): Promise<ConversationRow> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await session.api.get(
      `${API_URL}/workspaces/${wsId}/whatsapp/conversations?filter=all&limit=50`,
      { headers: session.headers },
    );
    const body = (await response.json()) as { items: ConversationRow[] };
    const found = body.items.find((item) => item.contact?.waId === waId);

    if (found) {
      return found;
    }

    await new Promise((done) => {
      setTimeout(done, 300);
    });
  }

  throw new Error(`a conversa de ${waId} não entrou na lista da API`);
}

/** Dá nível no módulo a uma pessoa do workspace. */
async function grant(email: string, level: 'atendente' | 'supervisor' | 'gestor'): Promise<void> {
  const members = await session.api.get(`${API_URL}/workspaces/${wsId}/members`, {
    headers: session.headers,
  });
  const body = (await members.json()) as {
    items: { userId: { id: string; email: string } }[];
  };
  const member = body.items.find((item) => item.userId.email === email);

  expect(member, `membro ${email} no workspace`).toBeTruthy();

  const granted = await session.api.put(
    `${API_URL}/workspaces/${wsId}/whatsapp/access/${member?.userId.id ?? ''}`,
    { headers: session.headers, data: { level } },
  );

  expect(granted.ok(), 'nível concedido').toBeTruthy();
}

/** Abre a Central já logado e espera o cabeçalho. */
async function openCentral(page: Page): Promise<void> {
  await page.goto(`/w/${wsId}/whatsapp`);
  await expect(page.getByRole('heading', { name: 'Central do WhatsApp' })).toBeVisible();
}

/** O painel da conversa aberta, para não confundir com a prévia da lista. */
function conversationPane(page: Page, name: string) {
  return page.getByRole('region', { name: new RegExp(`Conversa com ${name}`) });
}

/** Abre a conversa do contato pela lista. */
async function openConversation(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible({
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

test.describe('Central do WhatsApp', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser: launched }) => {
    session = await adminApi();
    wsId = session.wsId;
    browser = launched;
    await connect();

    context = await browser.newContext();
    await signInContext(context);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
    await session.dispose();
  });

  test('recebe a mensagem do cliente e responde pela tela', async () => {
    await deliver(
      envelope(
        inboundText({
          id: `wamid.e2e.${String(Date.now())}`,
          from: CONTACTS.responder,
          name: 'Ana do Teste',
          body: 'Bom dia, preciso de ajuda',
        }),
      ),
    );

    await openCentral(page);
    await expect(page.getByText('WhatsApp conectado')).toBeVisible();

    await openConversation(page, 'Ana do Teste');

    const pane = conversationPane(page, 'Ana do Teste');

    // Dentro da conversa: a prévia da lista mostra o mesmo texto.
    await expect(pane.getByText('Bom dia, preciso de ajuda')).toBeVisible();

    await page.getByRole('textbox', { name: 'Mensagem' }).fill('Bom dia! Já estou vendo isso.');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();

    await expect(pane.getByText('Bom dia! Já estou vendo isso.')).toBeVisible();
    // A mensagem enviada ganha o check do status.
    await expect(page.getByText('Enviada', { exact: true }).first()).toBeAttached({
      timeout: 20_000,
    });
  });

  test('envia imagem e áudio pelo anexo', async () => {
    await deliver(
      envelope(
        inboundText({
          id: `wamid.e2e.midia.${String(Date.now())}`,
          from: CONTACTS.midia,
          name: 'Bruno da Mídia',
          body: 'Mandei o comprovante?',
        }),
      ),
    );

    await openCentral(page);
    await openConversation(page, 'Bruno da Mídia');

    const file = page.locator('input[type="file"]');

    await file.setInputFiles({
      name: 'comprovante.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    });

    await expect(page.getByRole('img', { name: 'Imagem da conversa' })).toBeVisible({
      timeout: 20_000,
    });

    await file.setInputFiles({
      name: 'recado.ogg',
      mimeType: 'audio/ogg',
      buffer: Buffer.from('ogg-falso-do-e2e'),
    });

    await expect(page.getByRole('button', { name: 'Tocar o áudio' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('janela de 24 h fechada troca o campo pelo envio de template', async () => {
    await deliver(
      envelope(
        inboundText({
          id: `wamid.e2e.template.${String(Date.now())}`,
          from: CONTACTS.template,
          name: 'Carla Antiga',
          body: 'Mensagem de ontem',
          // Mais de 24 h: a janela de texto livre da Meta já fechou.
          secondsAgo: 60 * 60 * 30,
        }),
      ),
    );

    await openCentral(page);
    await openConversation(page, 'Carla Antiga');

    await expect(page.getByText('A janela de 24 horas fechou.', { exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0);

    await page.getByLabel('Template').selectOption('retorno_atendimento');
    await page.getByLabel('Variável 1').fill('Carla');
    await page.getByRole('button', { name: 'Enviar template' }).click();

    await expect(page.getByText('Template enviado.')).toBeVisible({ timeout: 20_000 });
  });

  test('atendente só vê a fila e as conversas dele', async () => {
    const attendant = await createWorkspaceMember('wa-atendente');

    await grant(attendant.email, 'atendente');

    // Uma conversa na fila e outra atribuída a quem não é o atendente.
    await deliver(
      envelope(
        inboundText({
          id: `wamid.e2e.fila.${String(Date.now())}`,
          from: CONTACTS.fila,
          name: 'Dora da Fila',
          body: 'Alguém me atende?',
        }),
      ),
    );
    await deliver(
      envelope(
        inboundText({
          id: `wamid.e2e.outra.${String(Date.now())}`,
          from: CONTACTS.outra,
          name: 'Elias de Outro',
          body: 'Falo com quem?',
        }),
      ),
    );

    await waitForConversation(CONTACTS.fila);

    const other = await waitForConversation(CONTACTS.outra);
    const me = await session.api.get(`${API_URL}/auth/me`, { headers: session.headers });
    const owner = (await me.json()) as { id: string };

    expect(owner.id, 'id da conta do seed').toBeTruthy();

    const assigned = await session.api.post(
      `${API_URL}/workspaces/${wsId}/whatsapp/conversations/${other.id}/assign`,
      { headers: session.headers, data: { assigneeId: owner.id } },
    );

    expect(assigned.ok(), 'conversa atribuída ao dono').toBeTruthy();
    expect(
      ((await assigned.json()) as { assigneeId: string | null }).assigneeId,
      'responsável gravado',
    ).toBe(owner.id);

    const attendantContext = await contextFor(attendant);

    try {
      const attendantPage = await attendantContext.newPage();

      await attendantPage.goto(`/w/${wsId}/whatsapp`);
      await expect(
        attendantPage.getByRole('heading', { name: 'Central do WhatsApp' }),
      ).toBeVisible();

      await expect(attendantPage.getByRole('button', { name: /Dora da Fila/ })).toBeVisible({
        timeout: 20_000,
      });
      await expect(attendantPage.getByRole('button', { name: /Elias de Outro/ })).toHaveCount(0);

      // Atendente não alcança as abas de gestor.
      await expect(attendantPage.getByRole('button', { name: 'Conexão' })).toHaveCount(0);
      await expect(attendantPage.getByRole('button', { name: 'Equipe' })).toHaveCount(0);
    } finally {
      await attendantContext.close();
    }
  });

  test('membro sem acesso não vê o item nem a Central', async () => {
    const outsider = await createWorkspaceMember('wa-fora');
    const ctx = await contextFor(outsider);

    try {
      const outsiderPage = await ctx.newPage();

      await outsiderPage.goto(`/w/${wsId}`);
      await expect(outsiderPage.getByRole('link', { name: 'Tarefas', exact: true })).toBeVisible();
      await expect(outsiderPage.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);

      await outsiderPage.goto(`/w/${wsId}/whatsapp`);
      await expect(outsiderPage.getByText('Sem acesso ao WhatsApp')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('gestor vê conexão e equipe, com a URL do webhook para copiar', async () => {
    await page.goto(`/w/${wsId}/whatsapp?aba=conexao`);
    await expect(page.getByRole('heading', { name: 'Número conectado' })).toBeVisible();
    // A URL é a da própria API (API_PUBLIC_URL), não a do front.
    await expect(page.getByRole('textbox', { name: /URL do webhook/ })).toHaveValue(
      `${API_URL}/integrations/whatsapp/webhook`,
    );

    await page.getByRole('button', { name: 'Testar conexão' }).click();
    await expect(page.getByText('Número conferido na Graph API.')).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/w/${wsId}/whatsapp?aba=equipe`);
    await expect(page.getByText('Dono e administrador são gestores pelo cargo.')).toBeVisible();
  });

  test('não rola para os lados em 360, 768 e 1280 nos dois temas', async () => {
    for (const theme of ['dark', 'light'] as const) {
      await page.goto(`/w/${wsId}/whatsapp`);
      await setTheme(page, theme);
      await expect(page.getByRole('heading', { name: 'Central do WhatsApp' })).toBeVisible();
      await expectNoHorizontalScroll(page);

      // Conversa aberta: a pilha do celular e as três colunas do desktop.
      await page.setViewportSize({ width: 1280, height: 900 });
      await openConversation(page, 'Ana do Teste');
      await expectNoHorizontalScroll(page);

      await page.setViewportSize({ width: 360, height: 780 });
      await page.getByRole('button', { name: 'Informações do cliente' }).click();
      await expect(page.getByRole('complementary', { name: 'Painel do cliente' })).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });
});
