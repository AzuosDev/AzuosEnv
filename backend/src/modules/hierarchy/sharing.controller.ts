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
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { ResourceQueryDto, ShareDto } from './dto/permission.dto';
import { permissionContextFrom } from './permission.service';
import { Permission, PermissionDocument } from './schemas/permission.schema';
import { SharingService } from './sharing.service';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/permissions')
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Recurso compartilhado.', type: Permission })
  share(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: ShareDto,
  ): Promise<PermissionDocument> {
    return this.sharing.share(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Compartilhamentos do recurso.', type: [Permission] })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ResourceQueryDto,
  ): Promise<PermissionDocument[]> {
    return this.sharing.list(permissionContextFrom(membership), query);
  }

  @Delete(':permissionId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Compartilhamento removido.', type: SuccessDto })
  async unshare(
    @CurrentMembership() membership: RequestMembership,
    @Param('permissionId', ParseObjectIdPipe) permissionId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.sharing.unshare(permissionContextFrom(membership), permissionId);

    return { success: true };
  }
}
