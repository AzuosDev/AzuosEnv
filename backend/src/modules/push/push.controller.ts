import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreatePushSubscriptionDto,
  PushPublicKeyDto,
  PushSubscriptionResultDto,
} from './dto/push-subscription.dto';
import { PushService } from './push.service';

/** Inscrições de push do usuário: um registro por navegador. */
@ApiTags('inbox')
@Controller('users/me/push-subscriptions')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  @ApiOperation({
    summary: 'Chave pública VAPID',
    description: 'Vazia quando o servidor não tem push configurado; o front esconde a opção.',
  })
  publicKey(): PushPublicKeyDto {
    return { publicKey: this.push.publicKey };
  }

  @Post()
  @ApiOperation({
    summary: 'Registra este navegador para receber push',
    description: 'O endpoint é a identidade da inscrição: reinscrever o mesmo não duplica.',
  })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionResultDto> {
    const saved = await this.push.subscribe(new Types.ObjectId(user.id), dto);

    return { id: String(saved._id) };
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Para de receber push neste navegador' })
  async unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Query('endpoint') endpoint: string,
  ): Promise<void> {
    await this.push.unsubscribe(new Types.ObjectId(user.id), endpoint ?? '');
  }
}
