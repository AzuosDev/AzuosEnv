import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  EVOLUTION_EVENTS,
  EVOLUTION_INTEGRATION,
  EVOLUTION_TIMEOUT_MS,
  WaInstanceState,
} from '../whatsapp-fields';
import { jidFromWaId, waIdFromJid } from '../whatsapp-jid';
import {
  WaCredentials,
  WaInstanceStatus,
  WaMediaFile,
  WaMediaRequest,
  WaOutbound,
  WaPhoneInfo,
  WaTemplate,
  WhatsappProvider,
} from './whatsapp.provider';

interface EvolutionQrCode {
  base64?: string;
  code?: string;
  pairingCode?: string | null;
}

interface EvolutionInstance {
  instanceName?: string;
  state?: string;
  status?: string;
  connectionStatus?: string;
  owner?: string;
  profileName?: string;
  number?: string;
}

interface EvolutionInstanceResponse {
  instance?: EvolutionInstance;
  hash?: string | { apikey?: string };
  qrcode?: EvolutionQrCode;
  base64?: string;
  state?: string;
}

interface EvolutionSendResponse {
  key?: { id?: string; remoteJid?: string };
}

interface EvolutionMediaResponse {
  base64?: string;
  mimetype?: string;
}

interface EvolutionNumberCheck {
  number?: string;
  jid?: string;
  exists?: boolean;
}

/**
 * Evolution API v2 over Baileys: the default provider. The number is paired by
 * reading a QR Code, the sending is free (no 24 h window and no templates) and
 * everything that happens on the number arrives through the webhook of the
 * instance. The connection is not official, so the number can be banned by
 * WhatsApp; the Conexão tab says so.
 */
@Injectable()
export class EvolutionProvider extends WhatsappProvider {
  private readonly logger = new Logger(EvolutionProvider.name);

  async send(credentials: WaCredentials, message: WaOutbound): Promise<string> {
    const [path, body] = this.outbound(message);
    const response = await this.request<EvolutionSendResponse>(credentials, path, body);
    const id = response.key?.id;

    if (!id) {
      throw this.failed('A Evolution não devolveu o id da mensagem.');
    }

    return id;
  }

  async inboundMedia(
    credentials: WaCredentials,
    request: WaMediaRequest,
  ): Promise<WaMediaFile | null> {
    // With `base64` on, the file travels inside the delivery and nothing else
    // has to be asked; the call below is the fallback for a server without it.
    if (request.base64) {
      return { buffer: Buffer.from(request.base64, 'base64'), mime: request.mime ?? '' };
    }

    const response = await this.tryRequest<EvolutionMediaResponse>(
      credentials,
      `chat/getBase64FromMediaMessage/${credentials.instanceName}`,
      { message: { key: { id: request.waMessageId } }, convertToMp4: false },
    );

    if (!response?.base64) {
      return null;
    }

    return {
      buffer: Buffer.from(response.base64, 'base64'),
      mime: response.mimetype ?? request.mime ?? '',
    };
  }

  async markRead(credentials: WaCredentials, waMessageId: string): Promise<void> {
    await this.tryRequest(credentials, `chat/markMessageAsRead/${credentials.instanceName}`, {
      readMessages: [{ id: waMessageId }],
    });
  }

  /** Evolution has no approved templates: the sending is free. */
  templates(_credentials: WaCredentials): Promise<WaTemplate[]> {
    return Promise.resolve([]);
  }

  async phoneInfo(credentials: WaCredentials): Promise<WaPhoneInfo | null> {
    const status = await this.state(credentials);

    return {
      displayPhone: status.displayPhone,
      verifiedName: status.verifiedName,
      qualityRating: '',
    };
  }

  /** Creates the instance already pointing its webhook at this API. */
  async createInstance(credentials: WaCredentials, webhookUrl: string): Promise<WaInstanceStatus> {
    const response = await this.request<EvolutionInstanceResponse>(credentials, 'instance/create', {
      instanceName: credentials.instanceName,
      integration: EVOLUTION_INTEGRATION,
      qrcode: true,
      webhook: {
        enabled: true,
        url: webhookUrl,
        // The URL already carries the secret, so the event must not be appended
        // to it; the file comes inside the delivery, so nothing is downloaded.
        byEvents: false,
        base64: true,
        events: [...EVOLUTION_EVENTS],
      },
    });

    return this.statusOf(response);
  }

  /** Keeps the webhook of an instance that already exists pointing here. */
  async setWebhook(credentials: WaCredentials, webhookUrl: string): Promise<void> {
    await this.tryRequest(credentials, `webhook/set/${credentials.instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: [...EVOLUTION_EVENTS],
      },
    });
  }

  async connect(credentials: WaCredentials): Promise<WaInstanceStatus> {
    const response = await this.request<EvolutionInstanceResponse>(
      credentials,
      `instance/connect/${credentials.instanceName}`,
      null,
      'GET',
    );

    return this.statusOf(response, 'connecting');
  }

  async state(credentials: WaCredentials): Promise<WaInstanceStatus> {
    const response = await this.request<EvolutionInstanceResponse>(
      credentials,
      `instance/connectionState/${credentials.instanceName}`,
      null,
      'GET',
    );

    return this.statusOf(response);
  }

  async disconnect(credentials: WaCredentials): Promise<void> {
    await this.request(credentials, `instance/logout/${credentials.instanceName}`, null, 'DELETE');
  }

  async restart(credentials: WaCredentials): Promise<WaInstanceStatus> {
    const response = await this.request<EvolutionInstanceResponse>(
      credentials,
      `instance/restart/${credentials.instanceName}`,
      null,
      'POST',
    );

    return this.statusOf(response, 'connecting');
  }

  async existingNumbers(credentials: WaCredentials, waIds: string[]): Promise<string[]> {
    if (waIds.length === 0) {
      return [];
    }

    const response = await this.request<
      EvolutionNumberCheck[] | { numbers?: EvolutionNumberCheck[] }
    >(credentials, `chat/whatsappNumbers/${credentials.instanceName}`, {
      numbers: waIds.map((waId) => jidFromWaId(waId)),
    });
    const rows = Array.isArray(response) ? response : (response.numbers ?? []);

    return rows
      .filter((row) => row.exists === true)
      .map((row) => waIdFromJid(row.jid ?? '') || (row.number ?? '').replace(/\D/g, ''))
      .filter((waId) => waId.length > 0);
  }

  /** Path and body of each type the module sends. */
  private outbound(message: WaOutbound): [string, Record<string, unknown>] {
    const base: Record<string, unknown> = { number: message.to };

    if (message.replyTo) {
      base.quoted = { key: { id: message.replyTo } };
    }

    if (message.type === 'interactive' && message.interactive) {
      const options = message.interactive.options.map((option) => option.title);

      // Baileys buttons are refused by most clients, so the menu goes as the
      // text of a numbered list; the bot already matches the answer by text.
      return [
        'message/sendText',
        {
          ...base,
          text: [
            message.interactive.header,
            message.interactive.body,
            ...options.map((title, index) => `${String(index + 1)}. ${title}`),
            message.interactive.footer,
          ]
            .filter((line) => Boolean(line))
            .join('\n'),
        },
      ];
    }

    if (message.type === 'text' || message.type === 'template') {
      return ['message/sendText', { ...base, text: message.text ?? '' }];
    }

    const file = message.file;
    const media = file ? file.buffer.toString('base64') : (message.mediaLink ?? '');

    // A voice note is its own endpoint; `sendMedia` would arrive as a file.
    if (message.type === 'audio') {
      return ['message/sendWhatsAppAudio', { ...base, audio: media, encoding: true }];
    }

    return [
      'message/sendMedia',
      {
        ...base,
        mediatype: message.type === 'sticker' ? 'image' : message.type,
        ...(file ? { mimetype: file.mime } : {}),
        media,
        fileName: message.filename ?? file?.filename ?? '',
        ...(message.caption ? { caption: message.caption } : {}),
      },
    ];
  }

  private statusOf(
    response: EvolutionInstanceResponse,
    fallback: WaInstanceState = 'close',
  ): WaInstanceStatus {
    const instance = response.instance ?? {};
    const raw = instance.state ?? instance.connectionStatus ?? instance.status ?? response.state;
    const state: WaInstanceState =
      raw === 'open' || raw === 'connecting' || raw === 'close' ? raw : fallback;
    const qrCode = response.qrcode?.base64 ?? response.base64 ?? null;

    return {
      state,
      qrCode: qrCode && qrCode.length > 0 ? qrCode : null,
      displayPhone: waIdFromJid(instance.owner ?? instance.number ?? ''),
      verifiedName: instance.profileName ?? '',
    };
  }

  /** Throws WHATSAPP_EVOLUTION_ERROR when the call fails; used by the writes. */
  private async request<T>(
    credentials: WaCredentials,
    path: string,
    payload: Record<string, unknown> | null,
    method: 'GET' | 'POST' | 'DELETE' = 'POST',
  ): Promise<T> {
    const base = credentials.baseUrl.replace(/\/$/, '');
    let response: Response;

    try {
      response = await fetch(`${base}/${path}`, {
        method,
        headers: {
          apikey: credentials.apiKey,
          ...(payload ? { 'content-type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(EVOLUTION_TIMEOUT_MS),
      });
    } catch (error) {
      throw this.failed(messageOf(error));
    }

    const text = await response.text();

    if (!response.ok) {
      this.logger.warn(`Evolution respondeu ${String(response.status)}: ${text.slice(0, 300)}`);

      throw this.failed(`a Evolution respondeu ${String(response.status)}.`);
    }

    return (text.length > 0 ? JSON.parse(text) : {}) as T;
  }

  /** Same call, but a failure only answers null (what may be skipped). */
  private async tryRequest<T>(
    credentials: WaCredentials,
    path: string,
    payload: Record<string, unknown> | null,
    method: 'GET' | 'POST' | 'DELETE' = 'POST',
  ): Promise<T | null> {
    try {
      return await this.request<T>(credentials, path, payload, method);
    } catch (error) {
      this.logger.warn(`Chamada à Evolution falhou: ${messageOf(error)}`);

      return null;
    }
  }

  private failed(detail: string): BadGatewayException {
    return new BadGatewayException({
      code: 'WHATSAPP_EVOLUTION_ERROR',
      message: `Não foi possível falar com a Evolution: ${detail}`,
    });
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
