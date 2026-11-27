import { expect } from '@playwright/test';
import { API_URL, nextIp, type AdminApi } from './helpers';

/**
 * Evolution falsa dos testes do WhatsApp. O servidor da API de e2e sobe com
 * WHATSAPP_MOCK=true, então a instância vive em memória: criar a conexão devolve
 * um QR Code de verdade na resposta e tudo o que o número faria chega pelo
 * webhook público, que este arquivo entrega.
 */
export const EVOLUTION_URL = 'http://localhost:8080';
export const EVOLUTION_KEY = 'chave-da-evolution-do-e2e';
export const EVOLUTION_INSTANCE = 'azuos-e2e';

interface QrBody {
  qrCode: string | null;
  status: string;
  webhookUrl: string;
}

/** Salva a conexão da Evolution no workspace (uma por workspace). */
export async function saveEvolution(session: AdminApi): Promise<void> {
  const saved = await session.api.put(`${API_URL}/workspaces/${session.wsId}/whatsapp/connection`, {
    headers: session.headers,
    data: {
      provider: 'evolution',
      baseUrl: EVOLUTION_URL,
      apiKey: EVOLUTION_KEY,
      instanceName: EVOLUTION_INSTANCE,
    },
  });

  expect(saved.ok(), 'conexão da Evolution cadastrada').toBeTruthy();
}

/** URL pública do webhook da instância; o segredo dela vem do backend. */
export async function webhookUrlOf(session: AdminApi): Promise<string> {
  const response = await session.api.get(
    `${API_URL}/workspaces/${session.wsId}/whatsapp/connection/qr`,
    { headers: session.headers },
  );

  expect(response.ok(), 'QR Code da conexão lido').toBeTruthy();

  const body = (await response.json()) as QrBody;

  expect(body.webhookUrl, 'o backend informa a URL do webhook da instância').toBeTruthy();

  return body.webhookUrl;
}

/** Entrega um evento no webhook público, como a Evolution faria. */
export async function deliverEvolution(
  session: AdminApi,
  webhookUrl: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await session.api.post(webhookUrl, {
    headers: { 'content-type': 'application/json', 'X-Forwarded-For': nextIp() },
    data: JSON.stringify(body),
  });

  expect(response.status(), 'webhook da Evolution aceito').toBe(200);
}

export function connectionUpdate(state: 'open' | 'close' | 'connecting'): Record<string, unknown> {
  return { event: 'connection.update', instance: EVOLUTION_INSTANCE, data: { state } };
}

export function qrCodeUpdate(base64: string): Record<string, unknown> {
  return {
    event: 'qrcode.updated',
    instance: EVOLUTION_INSTANCE,
    data: { qrcode: { base64 } },
  };
}

export function inboundText(options: {
  id: string;
  from: string;
  name: string;
  body: string;
}): Record<string, unknown> {
  return {
    event: 'messages.upsert',
    instance: EVOLUTION_INSTANCE,
    data: {
      key: { remoteJid: `${options.from}@s.whatsapp.net`, id: options.id, fromMe: false },
      pushName: options.name,
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: { conversation: options.body },
    },
  };
}

/** Mensagem de grupo, que o atendimento tem de ignorar. */
export function inboundGroup(id: string): Record<string, unknown> {
  return {
    event: 'messages.upsert',
    instance: EVOLUTION_INSTANCE,
    data: {
      key: { remoteJid: '120363000000000000@g.us', id, fromMe: false },
      pushName: 'Grupo da obra',
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: { conversation: 'bom dia a todos' },
    },
  };
}

/** Espera a conexão chegar ao estado pedido na API. */
export async function waitForStatus(session: AdminApi, status: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await session.api.get(
      `${API_URL}/workspaces/${session.wsId}/whatsapp/connection`,
      { headers: session.headers },
    );
    const body = (await response.json()) as { connection: { status: string } | null };

    if (body.connection?.status === status) {
      return;
    }

    await new Promise((done) => {
      setTimeout(done, 300);
    });
  }

  throw new Error(`a conexão não chegou em "${status}"`);
}
