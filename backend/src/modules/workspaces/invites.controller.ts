import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { Public } from '../../common/decorators/public.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { Audit } from '../audit/audit.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CurrentMembership, CurrentWorkspace } from './decorators/workspace-context.decorator';
import { Roles } from './decorators/roles.decorator';
import { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto';
import { WorkspaceGuard } from './guards/workspace.guard';
import { AcceptedInvite, CreatedInvite, InvitesService } from './invites.service';
import { Invite, InviteDocument } from './schemas/invite.schema';
import { WorkspaceDocument } from './schemas/workspace.schema';
import { RequestMembership, workspaceObjectId } from './workspace-context';

@ApiTags('workspace-invites')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Roles('admin')
@Controller('workspaces/:wsId/invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @Audit('invite.created', 'invite')
  @ApiCreatedResponse({ description: 'Convite criado; o link é enviado por e-mail.' })
  create(
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateInviteDto,
  ): Promise<CreatedInvite> {
    return this.invites.create(workspace, membership, dto);
  }

  @Get()
  @ApiPagedResponse(Invite, 'Convites pendentes.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<InviteDocument>> {
    return this.invites.listPending(workspaceObjectId(membership), query);
  }

  @Delete(':inviteId')
  @Audit('invite.revoked', 'invite', 'inviteId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Convite cancelado.' })
  async cancel(
    @CurrentMembership() membership: RequestMembership,
    @Param('inviteId', ParseObjectIdPipe) inviteId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.invites.cancel(workspaceObjectId(membership), inviteId);

    return { success: true };
  }
}

@ApiTags('workspace-invites')
@Controller('invites')
export class InviteAcceptController {
  constructor(private readonly invites: InvitesService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Convite aceito com conta existente ou recém-criada.' })
  accept(@Body() dto: AcceptInviteDto): Promise<AcceptedInvite> {
    return this.invites.accept(dto);
  }
}
