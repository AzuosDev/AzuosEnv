import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PubSubHttpClient, TokenParams, TokenRequest } from '@ably/pubsub-server';
import { RealtimeService, RealtimeTransport, publicChannels } from './realtime.service';

/** Token curto: o front renova, e token vazado expira junto. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** Canal → o que o portador pode fazer nele. Aqui, só ouvir. */
export type RealtimeCapability = Record<string, ['subscribe']>;

/**
 * Tempo real pelo Ably. Escolhido quando `ABLY_API_KEY` existe, que é o caso do
 * deploy serverless: a conexão do navegador fica no Ably e o servidor só
 * publica por HTTP, dentro do request que salvou o dado — sem socket, sem
 * processo longo. O cliente conecta com token que só assina os canais dele.
 *
 * O pacote é o `@ably/pubsub-server`, não o `ably`: conta cobrada por usuário
 * ativo (MAU) recusa o SDK antigo, e este marca o tráfego como de servidor,
 * que fica fora da contagem — só o navegador conta como usuário.
 */
@Injectable()
export class AblyRealtime extends RealtimeService {
  readonly transport: RealtimeTransport = 'ably';
  private readonly logger = new Logger(AblyRealtime.name);
  private readonly key: string;
  private rest: PubSubHttpClient | null = null;

  constructor(config: ConfigService) {
    super();
    this.key = config.get<string>('ABLY_API_KEY') ?? '';
  }

  async publish(channels: string[], event: string, data: Record<string, unknown>): Promise<void> {
    const targets = publicChannels(channels);

    if (targets.length === 0) {
      return;
    }

    const rest = await this.client();

    if (!rest) {
      return;
    }

    await Promise.all(
      targets.map(async (channel) => {
        try {
          await rest.channels.get(channel).publish(event, data);
        } catch (error) {
          this.logger.warn(
            `Falha ao publicar ${event} em ${channel}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }

  /**
   * Token de assinatura com a capacidade já recortada: um canal fora da lista
   * é recusado pelo próprio Ably, não pelo nosso código.
   */
  async createTokenRequest(
    userId: string,
    capability: RealtimeCapability,
  ): Promise<TokenRequest | null> {
    const rest = await this.client();

    if (!rest) {
      return null;
    }

    return await rest.auth.createTokenRequest({
      clientId: userId,
      capability: capability as TokenParams['capability'],
      ttl: TOKEN_TTL_MS,
    });
  }

  /**
   * O SDK entra por import dinâmico: sem `ABLY_API_KEY` ele nunca é carregado,
   * o que mantém o cold start do serverless fora do caminho.
   */
  private async client(): Promise<PubSubHttpClient | null> {
    if (this.key === '') {
      return null;
    }

    if (!this.rest) {
      const { createHttpClient } = await import('@ably/pubsub-server');

      this.rest = createHttpClient({ key: this.key });
    }

    return this.rest;
  }
}
