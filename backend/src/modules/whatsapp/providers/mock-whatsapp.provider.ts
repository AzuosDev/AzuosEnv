import { Injectable, Logger } from '@nestjs/common';
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

/** 1x1 PNG: media of the mock never leaves the process. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Stands in for the QR Code of an instance that is waiting to be read. */
const QR_CODE = `data:image/png;base64,${PIXEL_PNG.toString('base64')}`;

/**
 * WhatsApp in memory, chosen by WHATSAPP_MOCK outside production, for both
 * providers. The e2e of the front drives the whole module — pairing by QR
 * Code included — without an Evolution server and without network.
 */
@Injectable()
export class MockWhatsappProvider extends WhatsappProvider {
  private readonly logger = new Logger(MockWhatsappProvider.name);

  private sent = 0;

  /** Instances already read, so the state only opens after a connect. */
  private readonly paired = new Set<string>();

  /** Instances that exist on the fake server. */
  private readonly created = new Set<string>();

  send(_credentials: WaCredentials, message: WaOutbound): Promise<string> {
    this.sent += 1;
    this.logger.debug(`mock send ${message.type} para ${message.to}`);

    return Promise.resolve(`wamid.mock.${String(Date.now())}.${String(this.sent)}`);
  }

  inboundMedia(_credentials: WaCredentials, request: WaMediaRequest): Promise<WaMediaFile | null> {
    return Promise.resolve({
      buffer: request.base64 ? Buffer.from(request.base64, 'base64') : PIXEL_PNG,
      mime: request.mime ?? 'image/png',
    });
  }

  markRead(_credentials: WaCredentials, _waMessageId: string): Promise<void> {
    return Promise.resolve();
  }

  templates(credentials: WaCredentials): Promise<WaTemplate[]> {
    if (credentials.provider === 'evolution') {
      return Promise.resolve([]);
    }

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
      displayPhone: '5531900000000',
      verifiedName: 'Azuos Dev (mock)',
      qualityRating: 'GREEN',
    });
  }

  instanceExists(credentials: WaCredentials): Promise<boolean> {
    return Promise.resolve(this.created.has(credentials.instanceName));
  }

  createInstance(credentials: WaCredentials, webhookUrl: string): Promise<WaInstanceStatus> {
    this.logger.debug(`mock instance ${credentials.instanceName} em ${webhookUrl}`);
    this.created.add(credentials.instanceName);

    return Promise.resolve(this.waiting());
  }

  setWebhook(_credentials: WaCredentials, _webhookUrl: string): Promise<void> {
    return Promise.resolve();
  }

  connect(credentials: WaCredentials): Promise<WaInstanceStatus> {
    this.paired.add(credentials.instanceName);

    return Promise.resolve(this.waiting());
  }

  state(credentials: WaCredentials): Promise<WaInstanceStatus> {
    return Promise.resolve(
      this.paired.has(credentials.instanceName)
        ? {
            state: 'open',
            qrCode: null,
            displayPhone: '5531900000000',
            verifiedName: 'Azuos Dev (mock)',
          }
        : this.waiting(),
    );
  }

  disconnect(credentials: WaCredentials): Promise<void> {
    this.paired.delete(credentials.instanceName);

    return Promise.resolve();
  }

  restart(_credentials: WaCredentials): Promise<WaInstanceStatus> {
    return Promise.resolve(this.waiting());
  }

  existingNumbers(_credentials: WaCredentials, waIds: string[]): Promise<string[]> {
    return Promise.resolve(waIds.slice(0, 1));
  }

  private waiting(): WaInstanceStatus {
    return { state: 'connecting', qrCode: QR_CODE, displayPhone: '', verifiedName: '' };
  }
}
