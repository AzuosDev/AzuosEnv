import { ApiProperty } from '@nestjs/swagger';

/** O que o cliente precisa para abrir a conexão de tempo real desta aba. */
export class RealtimeTokenDto {
  @ApiProperty({
    enum: ['socket.io', 'ably'],
    description:
      'Transporte deste deploy: `ably` quando o servidor é serverless, `socket.io` em processo longo.',
  })
  transport: 'socket.io' | 'ably';

  @ApiProperty({
    type: Object,
    nullable: true,
    description:
      'Pedido de token do Ably, assinado e recortado nos canais do usuário; nulo no transporte socket.io.',
  })
  token: Record<string, unknown> | null;

  @ApiProperty({
    type: [String],
    description: 'Canais que este token pode assinar (user:{id}, ws:{wsId}, channel:{id}).',
  })
  channels: string[];
}
