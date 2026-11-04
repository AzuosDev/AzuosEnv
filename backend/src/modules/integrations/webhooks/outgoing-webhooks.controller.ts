import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CursorPage } from '../../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../../hierarchy/permission.service';
import { Roles } from '../../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RequestMembership } from '../../workspaces/workspace-context';
import {
  CreateOutgoingWebhookDto,
  DeliveryQueryDto,
  UpdateOutgoingWebhookDto,
} from './dto/outgoing-webhook.dto';
import { OutgoingWebhooksService, WebhookWithSecret } from './outgoing-webhooks.service';
import { OutgoingWebhookDocument } from './schemas/outgoing-webhook.schema';
import { WebhookDeliveryDocument } from './schemas/webhook-delivery.schema';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Roles('admin')
@Controller('workspaces/:wsId/webhooks')
export class OutgoingWebhooksController {
  constructor(private readonly webhooks: OutgoingWebhooksService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Webhook criado; o secret aparece só nesta resposta.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateOutgoingWebhookDto,
  ): Promise<WebhookWithSecret> {
    return this.webhooks.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Webhooks do workspace.' })
  list(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ items: OutgoingWebhookDocument[] }> {
    return this.webhooks.list(permissionContextFrom(membership));
  }

  @Get(':webhookId')
  @ApiOkResponse({ description: 'Webhook.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
  ): Promise<OutgoingWebhookDocument> {
    return this.webhooks.get(permissionContextFrom(membership), webhookId);
  }

  @Patch(':webhookId')
  @ApiOkResponse({ description: 'Webhook atualizado.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
    @Body() dto: UpdateOutgoingWebhookDto,
  ): Promise<WebhookWithSecret> {
    return this.webhooks.update(permissionContextFrom(membership), webhookId, dto);
  }

  @Delete(':webhookId')
  @ApiOkResponse({ description: 'Webhook removido com o log de entregas.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.webhooks.remove(permissionContextFrom(membership), webhookId);

    return { success: true };
  }

  @Get(':webhookId/deliveries')
  @ApiOkResponse({ description: 'Log de entregas, mais novas primeiro.' })
  deliveries(
    @CurrentMembership() membership: RequestMembership,
    @Param('webhookId', ParseObjectIdPipe) webhookId: Types.ObjectId,
    @Query() query: DeliveryQueryDto,
  ): Promise<CursorPage<WebhookDeliveryDocument>> {
    return this.webhooks.deliveriesOf(permissionContextFrom(membership), webhookId, query);
  }
}
