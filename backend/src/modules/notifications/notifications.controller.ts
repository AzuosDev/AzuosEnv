import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Types } from 'mongoose';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership, workspaceObjectId } from '../workspaces/workspace-context';
import { InboxCountsDto } from './dto/inbox-counts.dto';
import { InboxQueryDto, ReadAllResultDto, SnoozeNotificationDto } from './dto/inbox.dto';
import {
  NotificationPreferencesDto,
  UpdateNotificationSettingsDto,
} from './dto/notification-settings.dto';
import { NotificationPreferences } from './notification-fields';
import { NotificationSettingsService } from './notification-settings.service';
import { InboxCounts, NotificationsService } from './notifications.service';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@ApiTags('inbox')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/inbox')
export class InboxController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiPagedResponse(Notification, 'Notificações da aba pedida, da mais recente à mais antiga.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: InboxQueryDto,
  ): Promise<CursorPage<NotificationDocument>> {
    return this.notifications.inbox(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
      query,
    );
  }

  @Get('counts')
  @ApiOkResponse({
    type: InboxCountsDto,
    description: 'Não lidas por aba, mais os totais de adiadas e limpas.',
  })
  counts(@CurrentMembership() membership: RequestMembership): Promise<InboxCounts> {
    return this.notifications.counts(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
    );
  }

  @Post('read-all')
  @ApiOkResponse({ type: ReadAllResultDto, description: 'Quantas notificações foram marcadas.' })
  readAll(@CurrentMembership() membership: RequestMembership): Promise<{ updated: number }> {
    return this.notifications.markAllRead(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
    );
  }

  @Post(':notificationId/read')
  @ApiOkResponse({ type: Notification, description: 'Notificação marcada como lida.' })
  read(
    @CurrentMembership() membership: RequestMembership,
    @Param('notificationId', ParseObjectIdPipe) notificationId: Types.ObjectId,
  ): Promise<NotificationDocument> {
    return this.notifications.markRead(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
      notificationId,
      true,
    );
  }

  @Post(':notificationId/unread')
  @ApiOkResponse({ type: Notification, description: 'Notificação marcada como não lida.' })
  unread(
    @CurrentMembership() membership: RequestMembership,
    @Param('notificationId', ParseObjectIdPipe) notificationId: Types.ObjectId,
  ): Promise<NotificationDocument> {
    return this.notifications.markRead(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
      notificationId,
      false,
    );
  }

  @Post(':notificationId/snooze')
  @ApiOkResponse({ type: Notification, description: 'Notificação adiada até a data pedida.' })
  snooze(
    @CurrentMembership() membership: RequestMembership,
    @Param('notificationId', ParseObjectIdPipe) notificationId: Types.ObjectId,
    @Body() dto: SnoozeNotificationDto,
  ): Promise<NotificationDocument> {
    return this.notifications.snooze(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
      notificationId,
      new Date(dto.until),
    );
  }

  @Post(':notificationId/clear')
  @ApiOkResponse({ type: Notification, description: 'Notificação limpa da caixa de entrada.' })
  clear(
    @CurrentMembership() membership: RequestMembership,
    @Param('notificationId', ParseObjectIdPipe) notificationId: Types.ObjectId,
  ): Promise<NotificationDocument> {
    return this.notifications.clear(
      workspaceObjectId(membership),
      new Types.ObjectId(membership.userId),
      notificationId,
    );
  }
}

@ApiTags('inbox')
@ApiBearerAuth()
@Controller('users/me/notification-settings')
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Canais por tipo de notificação.',
    type: NotificationPreferencesDto,
  })
  get(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferences> {
    return this.settings.get(new Types.ObjectId(user.id));
  }

  @Patch()
  @ApiOkResponse({
    description: 'Preferências atualizadas.',
    type: NotificationPreferencesDto,
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationPreferences> {
    return this.settings.update(new Types.ObjectId(user.id), dto);
  }
}
