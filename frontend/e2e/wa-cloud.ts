import { createHmac } from 'node:crypto';
import { expect } from '@playwright/test';
import { API_URL, nextIp, type AdminApi } from './helpers';

/**
 * Cloud API falsa dos testes do WhatsApp. As credenciais são as mesmas em todos
 * os specs do módulo de propósito: a conexão é uma por workspace, e o webhook
 * só aceita o evento assinado com o App Secret que está cadastrado.
 */
export const PHONE_NUMBER_ID = '55590001';
export const WABA_ID = '555000';
export const APP_SECRET = 'segredo-do-app-do-e2e';
export const VERIFY_TOKEN = 'verify-token-do-e2e';

/** Cadastra a conexão e confirma o número, que é o que marca "conectado". */
export async function connectWa(session: AdminApi): Promise<void> {
  const saved = await session.api.put(`${API_URL}/workspaces/${session.wsId}/whatsapp/connection`, {
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

  expect(saved.ok(), 'conexão do WhatsApp cadastrada').toBeTruthy();

  const tested = await session.api.post(
    `${API_URL}/workspaces/${session.wsId}/whatsapp/connection/test`,
    { headers: session.headers },
  );

  expect(
    tested.ok(),
    'teste da conexão: a API de e2e precisa da Cloud API falsa (WHATSAPP_MOCK=true)',
  ).toBeTruthy();
}

/** Envelope da Cloud API com um `changes[].value`. */
export function envelope(value: Record<string, unknown>): string {
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

export function inboundText(options: {
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
export async function deliver(session: AdminApi, body: string): Promise<void> {
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

interface MessageRow {
  body: string;
  direction: string;
  fromBot: boolean;
}

/**
 * Espera a conversa do número aparecer na API: o webhook responde 200 antes de
 * processar, então o cenário só continua quando a fila terminou.
 */
export async function waitForConversation(
  session: AdminApi,
  waId: string,
): Promise<ConversationRow> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await session.api.get(
      `${API_URL}/workspaces/${session.wsId}/whatsapp/conversations?filter=all&limit=50`,
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

/** Espera o bot escrever um texto na conversa; devolve o que ele enviou. */
export async function waitForBotMessage(
  session: AdminApi,
  conversationId: string,
  text: string,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await session.api.get(
      `${API_URL}/workspaces/${session.wsId}/whatsapp/conversations/${conversationId}/messages?limit=30`,
      { headers: session.headers },
    );
    const body = (await response.json()) as { items: MessageRow[] };
    const found = body.items.find(
      (item) => item.direction === 'outbound' && item.fromBot && item.body.includes(text),
    );

    if (found) {
      return found.body;
    }

    await new Promise((done) => {
      setTimeout(done, 300);
    });
  }

  throw new Error(`o bot não respondeu com "${text}"`);
}

/** Devolve o bot e o horário ao estado desligado, para os outros specs. */
export async function resetWaBot(session: AdminApi): Promise<void> {
  await session.api.put(`${API_URL}/workspaces/${session.wsId}/whatsapp/bot`, {
    headers: session.headers,
    data: {
      enabled: false,
      pauseMinutes: 30,
      hours: { enabled: false, days: [], holidays: [], awayMessage: '' },
    },
  });

  const rules = await session.api.get(`${API_URL}/workspaces/${session.wsId}/whatsapp/bot/rules`, {
    headers: session.headers,
  });
  const body = (await rules.json()) as { items: { id: string }[] };

  for (const rule of body.items) {
    await session.api.delete(
      `${API_URL}/workspaces/${session.wsId}/whatsapp/bot/rules/${rule.id}`,
      { headers: session.headers },
    );
  }
}
