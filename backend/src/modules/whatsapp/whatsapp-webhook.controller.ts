import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RawBodyRequest } from '../../app.setup';
import { Public } from '../../common/decorators/public.decorator';
import { WaWebhookResultDto } from './dto/whatsapp-result.dto';
import { WA_SIGNATURE_HEADER } from './whatsapp-fields';
import { WaWebhookResult, WhatsappWebhookService } from './whatsapp-webhook.service';

/**
 * Public entry point of the Cloud API. The GET answers the handshake of Meta and
 * the POST only accepts a body signed with the App Secret of the connection.
 */
@ApiTags('whatsapp')
@Controller('integrations/whatsapp/webhook')
export class WhatsappWebhookController {
  constructor(private readonly webhook: WhatsappWebhookService) {}

  @Public()
  @Get()
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  @ApiOkResponse({ description: 'Desafio devolvido em texto puro.' })
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') verifyToken: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): Promise<string> {
    return this.webhook.verify({ mode, verifyToken, challenge });
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Evento aceito.', type: WaWebhookResultDto })
  receive(
    @Req() request: RawBodyRequest,
    @Headers(WA_SIGNATURE_HEADER) signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<WaWebhookResult> {
    return this.webhook.receive({
      rawBody: request.rawBody,
      signature,
      body: body && typeof body === 'object' ? body : {},
    });
  }
}
