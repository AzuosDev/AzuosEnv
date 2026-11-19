import { Injectable, Logger } from '@nestjs/common';
import {
  WaCredentials,
  WaMediaFile,
  WaMediaInfo,
  WaOutbound,
  WaPhoneInfo,
  WaTemplate,
  WaUploadInput,
  WhatsappGraphProvider,
} from './whatsapp-graph.provider';

/** 1x1 PNG: media of the mock never leaves the process. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * WhatsApp Cloud API in memory, chosen by WHATSAPP_MOCK outside production. The
 * e2e of the front drives the whole module without a WABA and without network.
 */
@Injectable()
export class MockWhatsappGraphProvider extends WhatsappGraphProvider {
  private readonly logger = new Logger(MockWhatsappGraphProvider.name);
  private sent = 0;

  send(_credentials: WaCredentials, message: WaOutbound): Promise<string> {
    this.sent += 1;
    this.logger.debug(`mock send ${message.type} para ${message.to}`);

    return Promise.resolve(`wamid.mock.${String(Date.now())}.${String(this.sent)}`);
  }

  upload(_credentials: WaCredentials, file: WaUploadInput): Promise<string> {
    return Promise.resolve(`mock-media-${encodeURIComponent(file.filename)}`);
  }

  mediaInfo(_credentials: WaCredentials, mediaId: string): Promise<WaMediaInfo | null> {
    return Promise.resolve({
      url: `https://mock.graph.invalid/${mediaId}`,
      mime: 'image/png',
      size: PIXEL_PNG.length,
    });
  }

  download(_credentials: WaCredentials, _url: string): Promise<WaMediaFile | null> {
    return Promise.resolve({ buffer: PIXEL_PNG, mime: 'image/png' });
  }

  markRead(_credentials: WaCredentials, _waMessageId: string): Promise<void> {
    return Promise.resolve();
  }

  templates(_credentials: WaCredentials): Promise<WaTemplate[]> {
    return Promise.resolve([
      {
        name: 'retorno_atendimento',
        language: 'pt_BR',
        status: 'APPROVED',
        category: 'UTILITY',
        variables: 1,
      },
      {
        name: 'aviso_sem_variavel',
        language: 'pt_BR',
        status: 'APPROVED',
        category: 'UTILITY',
        variables: 0,
      },
    ]);
  }

  phoneInfo(_credentials: WaCredentials): Promise<WaPhoneInfo | null> {
    return Promise.resolve({
      displayPhone: '+55 31 90000-0000',
      verifiedName: 'Azuos Dev (mock)',
      qualityRating: 'GREEN',
    });
  }
}
