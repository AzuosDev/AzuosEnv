import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WaProvider } from '../whatsapp-fields';
import { CloudApiProvider } from './cloud-api.provider';
import { EvolutionProvider } from './evolution.provider';
import { MockWhatsappProvider } from './mock-whatsapp.provider';
import { WaCredentials, WhatsappProvider } from './whatsapp.provider';

/**
 * Picks the provider of each call. The provider is a field of the connection,
 * not of the environment: a workspace already on the Cloud API keeps talking
 * through it while the new ones are paired on the Evolution.
 *
 * WHATSAPP_MOCK (never in production) answers both with the provider in memory,
 * which is what lets the e2e of the front pair a number without a server.
 */
@Injectable()
export class WhatsappProviders {
  private readonly mocked: boolean;

  constructor(
    config: ConfigService,
    private readonly evolution: EvolutionProvider,
    private readonly cloud: CloudApiProvider,
    private readonly mock: MockWhatsappProvider,
  ) {
    this.mocked =
      config.get<boolean>('WHATSAPP_MOCK') === true &&
      config.get<string>('NODE_ENV') !== 'production';
  }

  of(provider: WaProvider): WhatsappProvider {
    if (this.mocked) {
      return this.mock;
    }

    return provider === 'cloud' ? this.cloud : this.evolution;
  }

  forCredentials(credentials: WaCredentials): WhatsappProvider {
    return this.of(credentials.provider);
  }
}
