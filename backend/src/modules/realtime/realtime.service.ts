/**
 * Canais que o cliente pode assinar de fora. Só eles saem do servidor quando o
 * transporte é Ably: sala que ninguém assina seria mensagem paga sem ouvinte.
 */
export const PUBLIC_CHANNEL_PREFIXES = ['user:', 'ws:', 'channel:'] as const;

export type RealtimeTransport = 'socket.io' | 'ably';

/**
 * Publicação de evento de domínio, independente do transporte. Socket.IO só
 * funciona em processo longo; em host serverless (Vercel) a conexão vive fora,
 * no Ably, e publicar é um POST dentro do mesmo request que salvou o dado.
 */
export abstract class RealtimeService {
  abstract readonly transport: RealtimeTransport;

  /** Nunca lança: tempo real não derruba a escrita que o originou. */
  abstract publish(channels: string[], event: string, data: Record<string, unknown>): Promise<void>;
}

/** Só os canais que um cliente consegue assinar, sem repetição. */
export function publicChannels(channels: string[]): string[] {
  return [
    ...new Set(
      channels.filter((channel) =>
        PUBLIC_CHANNEL_PREFIXES.some((prefix) => channel.startsWith(prefix)),
      ),
    ),
  ];
}
