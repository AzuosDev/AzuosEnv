import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GRAPH_TIMEOUT_MS } from '../whatsapp-fields';
import {
  WaCredentials,
  WaInteractive,
  WaMediaFile,
  WaMediaInfo,
  WaOutbound,
  WaPhoneInfo,
  WaTemplate,
  WaUploadInput,
  WhatsappGraphProvider,
} from './whatsapp-graph.provider';

const GRAPH_HOST = 'https://graph.facebook.com';

interface GraphMessageResponse {
  messages?: { id?: string }[];
}

interface GraphTemplateResponse {
  data?: {
    name?: string;
    language?: string;
    status?: string;
    category?: string;
    components?: { type?: string; text?: string }[];
  }[];
}

interface GraphPhoneResponse {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
}

/** WhatsApp Cloud API over the Graph API of Meta. */
@Injectable()
export class MetaGraphProvider extends WhatsappGraphProvider {
  private readonly logger = new Logger(MetaGraphProvider.name);

  private readonly version: string;

  constructor(config: ConfigService) {
    super();
    this.version = config.get<string>('META_GRAPH_VERSION') ?? 'v21.0';
  }

  async send(credentials: WaCredentials, message: WaOutbound): Promise<string> {
    const body = await this.post<GraphMessageResponse>(
      credentials,
      `${credentials.phoneNumberId}/messages`,
      messageBody(message),
    );
    const id = body.messages?.[0]?.id;

    if (!id) {
      throw this.failed('A Graph API não devolveu o id da mensagem.');
    }

    return id;
  }

  async upload(credentials: WaCredentials, file: WaUploadInput): Promise<string> {
    const form = new FormData();

    form.append('messaging_product', 'whatsapp');
    form.append('type', file.mime);
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mime }),
      file.filename,
    );

    const body = await this.request<{ id?: string }>(
      credentials,
      `${credentials.phoneNumberId}/media`,
      { method: 'POST', body: form },
    );

    if (!body?.id) {
      throw this.failed('A Graph API não aceitou o arquivo.');
    }

    return body.id;
  }

  async mediaInfo(credentials: WaCredentials, mediaId: string): Promise<WaMediaInfo | null> {
    const body = await this.tryRequest<{ url?: string; mime_type?: string; file_size?: number }>(
      credentials,
      mediaId,
      { method: 'GET' },
    );

    return body?.url
      ? { url: body.url, mime: body.mime_type ?? '', size: Number(body.file_size ?? 0) }
      : null;
  }

  async download(credentials: WaCredentials, url: string): Promise<WaMediaFile | null> {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Download da mídia do WhatsApp falhou: ${response.status}`);

        return null;
      }

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mime: response.headers.get('content-type') ?? '',
      };
    } catch (error) {
      this.logger.warn(`Download da mídia do WhatsApp falhou: ${messageOf(error)}`);

      return null;
    }
  }

  async markRead(credentials: WaCredentials, waMessageId: string): Promise<void> {
    await this.tryRequest(credentials, `${credentials.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: waMessageId,
      }),
    });
  }

  async templates(credentials: WaCredentials): Promise<WaTemplate[]> {
    const body = await this.post<GraphTemplateResponse>(
      credentials,
      `${credentials.wabaId}/message_templates?limit=100`,
      null,
      'GET',
    );

    return (body.data ?? []).map((template) => ({
      name: template.name ?? '',
      language: template.language ?? '',
      status: template.status ?? '',
      category: template.category ?? '',
      variables: countVariables(template.components ?? []),
    }));
  }

  async phoneInfo(credentials: WaCredentials): Promise<WaPhoneInfo | null> {
    const body = await this.post<GraphPhoneResponse>(
      credentials,
      `${credentials.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      null,
      'GET',
    );

    return {
      displayPhone: body.display_phone_number ?? '',
      verifiedName: body.verified_name ?? '',
      qualityRating: body.quality_rating ?? '',
    };
  }

  private post<T>(
    credentials: WaCredentials,
    path: string,
    payload: Record<string, unknown> | null,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    return this.request<T>(credentials, path, {
      method,
      headers: payload ? { 'content-type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }

  /** Throws WHATSAPP_GRAPH_ERROR when the call fails; used by the writes. */
  private async request<T>(
    credentials: WaCredentials,
    path: string,
    init: RequestInit,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${GRAPH_HOST}/${this.version}/${path}`, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${credentials.accessToken}` },
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      });
    } catch (error) {
      throw this.failed(messageOf(error));
    }

    const text = await response.text();

    if (!response.ok) {
      this.logger.warn(`Graph API respondeu ${response.status}: ${text.slice(0, 300)}`);

      throw this.failed(`A Graph API respondeu ${response.status}.`);
    }

    return (text.length > 0 ? JSON.parse(text) : {}) as T;
  }

  /** Same call, but a failure only answers null (reads that may be skipped). */
  private async tryRequest<T>(
    credentials: WaCredentials,
    path: string,
    init: RequestInit,
  ): Promise<T | null> {
    try {
      return await this.request<T>(credentials, path, init);
    } catch (error) {
      this.logger.warn(`Chamada à Graph API falhou: ${messageOf(error)}`);

      return null;
    }
  }

  private failed(detail: string): BadGatewayException {
    return new BadGatewayException({
      code: 'WHATSAPP_GRAPH_ERROR',
      message: `Não foi possível falar com o WhatsApp: ${detail}`,
    });
  }
}

/** Body of `POST /messages` for each type the module sends. */
function messageBody(message: WaOutbound): Record<string, unknown> {
  const base: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: message.to,
    type: message.type,
  };

  if (message.replyTo) {
    base.context = { message_id: message.replyTo };
  }

  if (message.type === 'template' && message.template) {
    base.template = {
      name: message.template.name,
      language: { code: message.template.language },
      components:
        message.template.variables.length > 0
          ? [
              {
                type: 'body',
                parameters: message.template.variables.map((text) => ({ type: 'text', text })),
              },
            ]
          : [],
    };

    return base;
  }

  if (message.type === 'text') {
    base.text = { body: message.text ?? '', preview_url: false };

    return base;
  }

  if (message.type === 'interactive' && message.interactive) {
    base.interactive = interactiveBody(message.interactive);

    return base;
  }

  const media: Record<string, unknown> = message.mediaId
    ? { id: message.mediaId }
    : { link: message.mediaLink ?? '' };

  if (message.caption && message.type !== 'audio' && message.type !== 'sticker') {
    media.caption = message.caption;
  }

  if (message.filename && message.type === 'document') {
    media.filename = message.filename;
  }

  base[message.type] = media;

  return base;
}

/** Body of an interactive message: up to 3 buttons, or one list of rows. */
function interactiveBody(interactive: WaInteractive): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: interactive.kind === 'list' ? 'list' : 'button',
    body: { text: interactive.body },
  };

  if (interactive.header) {
    body.header = { type: 'text', text: interactive.header };
  }

  if (interactive.footer) {
    body.footer = { text: interactive.footer };
  }

  body.action =
    interactive.kind === 'list'
      ? {
          button: interactive.buttonLabel ?? 'Ver opções',
          sections: [
            {
              title: interactive.header || 'Opções',
              rows: interactive.options.map((option) => ({
                id: option.id,
                title: option.title,
                ...(option.description ? { description: option.description } : {}),
              })),
            },
          ],
        }
      : {
          buttons: interactive.options.map((option) => ({
            type: 'reply',
            reply: { id: option.id, title: option.title },
          })),
        };

  return body;
}

function countVariables(components: { type?: string; text?: string }[]): number {
  const body = components.find((component) => (component.type ?? '').toUpperCase() === 'BODY');
  const matches = (body?.text ?? '').match(/\{\{\s*\d+\s*\}\}/g);

  return matches ? new Set(matches).size : 0;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
