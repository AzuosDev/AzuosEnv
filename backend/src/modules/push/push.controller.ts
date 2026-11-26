import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreatePushSubscriptionDto,
  PushPublicKeyDto,
  PushSubscriptionResultDto,
  PushTestResultDto,
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

  @Post('test')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Manda um aviso de teste para os dispositivos deste usuário',
    description:
      'Devolve o resultado de cada dispositivo (status do serviço de push e motivo da falha), ' +
      'e remove a inscrição que o navegador descartou ou que nasceu com outra chave VAPID.',
  })
  async test(@CurrentUser() user: AuthenticatedUser): Promise<PushTestResultDto> {
    const results = await this.push.sendTest(new Types.ObjectId(user.id));

    return { configured: this.push.publicKey !== '', results };
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
