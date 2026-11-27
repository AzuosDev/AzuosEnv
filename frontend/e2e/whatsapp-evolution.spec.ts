import { expect, test, type Page } from '@playwright/test';
import { adminApi, expectNoHorizontalScroll, signIn, type AdminApi } from './helpers';
import { connectWa } from './wa-cloud';
import {
  connectionUpdate,
  deliverEvolution,
  inboundGroup,
  inboundText,
  qrCodeUpdate,
  saveEvolution,
  waitForStatus,
  webhookUrlOf,
} from './wa-evolution';

/**
 * Conexão do WhatsApp pela Evolution API v2 (Etapa 19.2). A API de e2e sobe com
 * WHATSAPP_MOCK=true, então a instância é a falsa: Conectar devolve um QR Code
 * de verdade e tudo o que o número faria entra pelo webhook público.
 *
 * A conexão é uma por workspace, e os outros specs do módulo usam a Cloud API no
 * mesmo workspace do seed, então o `afterAll` devolve a conexão para ela.
 */
const CONTACT = '5531977770001';

let session: AdminApi;
let wsId = '';
let webhookUrl = '';
let page: Page;

test.describe.configure({ mode: 'serial' });

test.describe('Central do WhatsApp — Evolution', () => {
  test.beforeAll(async ({ browser }) => {
    session = await adminApi();
    wsId = session.wsId;
    await saveEvolution(session);
    webhookUrl = await webhookUrlOf(session);

    page = await browser.newPage();
    await signIn(page);
  });

  test.afterAll(async () => {
    await connectWa(session);
    await session.dispose();
    await page.close();
  });

  test('a aba Conexão salva a Evolution, avisa do risco e mostra o QR Code', async () => {
    await page.goto(`/w/${wsId}/whatsapp?aba=conexao`);
    await expect(page.getByRole('heading', { name: 'Número conectado' })).toBeVisible();

    // Evolution é o padrão do seletor e o aviso fica fixo na aba.
    await expect(page.getByLabel('Provedor')).toHaveValue('evolution');
    await expect(
      page.getByText(
        'Conexão não oficial: o número pode ser banido pelo WhatsApp. Evite disparos em massa.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: /URL do servidor/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Nome da instância/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /URL do webhook/ })).toHaveValue(webhookUrl);

    // O provedor salvo aparece no resumo do número.
    await expect(page.getByText('Evolution (QR Code)').first()).toBeVisible();

    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await expect(page.getByRole('img', { name: 'QR Code para conectar o WhatsApp' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('WhatsApp pendente')).toBeVisible();
  });

  test('o QR Code novo e a conexão confirmada chegam pelo webhook', async () => {
    const other =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

    await deliverEvolution(session, webhookUrl, qrCodeUpdate(other));
    await expect(
      page.getByRole('img', { name: 'QR Code para conectar o WhatsApp' }),
    ).toHaveAttribute('src', other, { timeout: 20_000 });

    await deliverEvolution(session, webhookUrl, connectionUpdate('open'));
    await waitForStatus(session, 'connected');

    await expect(page.getByText('WhatsApp conectado')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('img', { name: 'QR Code para conectar o WhatsApp' })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: 'Desconectar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reiniciar' })).toBeVisible();
  });

  test('recebe a mensagem, responde livre e não oferece template', async () => {
    await deliverEvolution(
      session,
      webhookUrl,
      inboundText({ id: 'EVO.E2E.1', from: CONTACT, name: 'Joana Evolution', body: 'Bom dia!' }),
    );
    // Grupo não é atendimento: não pode virar conversa.
    await deliverEvolution(session, webhookUrl, inboundGroup('EVO.E2E.2'));

    await page.goto(`/w/${wsId}/whatsapp?aba=conversas`);
    await expect(page.getByRole('button', { name: /Joana Evolution/ })).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole('button', { name: /Joana Evolution/ })
      .first()
      .click();

    const pane = page.getByRole('region', { name: /Conversa com Joana Evolution/ });

    await expect(pane.getByText('Bom dia!')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Grupo da obra/ })).toHaveCount(0);

    // Sem janela de 24 h: o campo de texto está lá e o template não existe.
    const field = pane.getByRole('textbox', { name: 'Mensagem' });

    await expect(field).toBeVisible();
    await expect(page.getByText('A janela de 24 horas fechou', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enviar template' })).toHaveCount(0);

    await field.fill('Bom dia, Joana! Já verifico.');
    await pane.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(pane.getByText('Bom dia, Joana! Já verifico.')).toBeVisible({ timeout: 20_000 });
  });

  test('desconectar devolve o QR Code e o cabeçalho avisa', async () => {
    await page.goto(`/w/${wsId}/whatsapp?aba=conexao`);
    await page.getByRole('button', { name: 'Desconectar' }).click();
    await expect(page.getByText('WhatsApp desconectado')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeVisible();
  });

  test('a aba Conexão não rola para os lados em 360, 768 e 1280', async () => {
    await page.goto(`/w/${wsId}/whatsapp?aba=conexao`);
    await expect(page.getByRole('heading', { name: 'Número conectado' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByLabel('Provedor')).toHaveValue('evolution');
  });
});
