import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AblyRealtime } from './ably.realtime';
import { RealtimeTokenDto } from './dto/realtime-token.dto';
import { RealtimeService } from './realtime.service';
import { RoomAccessService } from './room-access.service';

/** Credencial da conexão de tempo real da aba. */
@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly rooms: RoomAccessService,
  ) {}

  @Post('token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Credencial de tempo real desta aba',
    description:
      'No transporte Ably devolve um token recortado nos canais do usuário (a própria sala, ' +
      'os workspaces ativos e os canais de chat visíveis). No Socket.IO só diz o transporte: ' +
      'a conexão usa o access token no handshake.',
  })
  async token(@CurrentUser() user: AuthenticatedUser): Promise<RealtimeTokenDto> {
    const capability = await this.rooms.subscribeCapability(user.id);
    const channels = Object.keys(capability);

    if (!(this.realtime instanceof AblyRealtime)) {
      return { transport: this.realtime.transport, token: null, channels };
    }

    const token = await this.realtime.createTokenRequest(user.id, capability);

    return {
      transport: 'ably',
      token: token as unknown as Record<string, unknown> | null,
      channels,
    };
  }
}
