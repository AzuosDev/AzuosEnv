import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../../common/swagger/api-paged-response.decorator';
import { Types } from 'mongoose';
import { Audit } from '../../audit/audit.decorator';
import { CursorPage } from '../../../common/pagination/cursor';
import { SuccessDto } from '../../../common/dto/api-error.dto';
import { ApiWorkspaceParam } from '../../../common/swagger/api-workspace-param.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../../hierarchy/permission.service';
import { Roles } from '../../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RequestMembership } from '../../workspaces/workspace-context';
import {
  OutgoingWebhookResultDto,
  OutgoingWebhooksResultDto,
} from './dto/outgoing-webhook-result.dto';
import {
  CreateOutgoingWebhookDto,
  DeliveryQueryDto,
  UpdateOutgoingWebhookDto,
} from './dto/outgoing-webhook.dto';
import { OutgoingWebhooksService, WebhookWithSecret } from './outgoing-webhooks.service';
import { OutgoingWebhook, OutgoingWebhookDocument } from './schemas/outgoing-webhook.schema';
import { WebhookDelivery, WebhookDeliveryDocument } from './schemas/webhook-delivery.schema';

@ApiTags('integrations')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Roles('admin')
@Controller('workspaces/:wsId/webhooks')
export class OutgoingWebhooksController {
  constructor(private readonly webhooks: OutgoingWebhooksService) {}

  @Post()
  @Audit('webhook.created', 'webhook')
  @ApiCreatedResponse({
    description: 'Webhook criado; o secret aparece só nesta resposta.',
    type: OutgoingWebhookResultDto,
  })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateOutgoingWebhookDto,
  ): Promise<WebhookWithSecret> {
    return this.webhooks.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Webhooks do workspace.', type: OutgoingWebhooksResultDto })
  list(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ items: OutgoingWebhookDocument[] }> {
    return this.webhooks.list(permissionContextFrom(membership));
  }

  @Get(':webhookId')
  @ApiOkResponse({ description: 'Webhook.', type: OutgoingWebhook })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
  ): Promise<OutgoingWebhookDocument> {
    return this.webhooks.get(permissionContextFrom(membership), webhookId);
  }

  @Patch(':webhookId')
  @Audit('webhook.updated', 'webhook', 'webhookId')
  @ApiOkResponse({ description: 'Webhook atualizado.', type: OutgoingWebhookResultDto })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
    @Body() dto: UpdateOutgoingWebhookDto,
  ): Promise<WebhookWithSecret> {
    return this.webhooks.update(permissionContextFrom(membership), webhookId, dto);
  }

  @Delete(':webhookId')
  @Audit('webhook.deleted', 'webhook', 'webhookId')
  @ApiOkResponse({ description: 'Webhook removido com o log de entregas.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.webhooks.remove(permissionContextFrom(membership), webhookId);

    return { success: true };
  }

  @Post(':webhookId/deliveries/:deliveryId/redeliver')
  @HttpCode(HttpStatus.OK)
  @Audit('webhook.redelivered', 'webhook', 'webhookId')
  @ApiOkResponse({
    description: 'Entrega reenviada; o reenvio é uma linha nova do log.',
    type: WebhookDelivery,
  })
  redeliver(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
    @Param('deliveryId', ParseObjectIdPipe) deliveryId: Types.ObjectId,
  ): Promise<WebhookDeliveryDocument> {
    return this.webhooks.redeliver(permissionContextFrom(membership), webhookId, deliveryId);
  }

  @Get(':webhookId/deliveries')
  @ApiPagedResponse(WebhookDelivery, 'Log de entregas, mais novas primeiro.')
  deliveries(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
    @Query() query: DeliveryQueryDto,
  ): Promise<CursorPage<WebhookDeliveryDocument>> {
    return this.webhooks.deliveriesOf(permissionContextFrom(membership), webhookId, query);
  }
}
