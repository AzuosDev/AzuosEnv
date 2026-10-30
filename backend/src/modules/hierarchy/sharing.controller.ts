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
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { ResourceQueryDto, ShareDto } from './dto/permission.dto';
import { permissionContextFrom } from './permission.service';
import { PermissionDocument } from './schemas/permission.schema';
import { SharingService } from './sharing.service';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/permissions')
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Recurso compartilhado.' })
  share(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: ShareDto,
  ): Promise<PermissionDocument> {
    return this.sharing.share(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Compartilhamentos do recurso.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ResourceQueryDto,
  ): Promise<PermissionDocument[]> {
    return this.sharing.list(permissionContextFrom(membership), query);
  }

  @Delete(':permissionId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Compartilhamento removido.' })
  async unshare(
    @CurrentMembership() membership: RequestMembership,
    @Param('permissionId', ParseObjectIdPipe) permissionId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.sharing.unshare(permissionContextFrom(membership), permissionId);

    return { success: true };
  }
}
