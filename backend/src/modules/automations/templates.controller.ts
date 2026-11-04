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
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { RequestMembership } from '../workspaces/workspace-context';
import { ApplyTemplateDto, CreateTemplateDto, TemplateQueryDto } from './dto/template.dto';
import { Template, TemplateDocument } from './schemas/template.schema';
import { AppliedTemplate, TemplatesService } from './templates.service';

@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Recurso salvo como template.', type: Template })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateTemplateDto,
  ): Promise<TemplateDocument> {
    return this.templates.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Template, 'Templates do workspace, mais novos primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: TemplateQueryDto,
  ): Promise<CursorPage<TemplateDocument>> {
    return this.templates.list(permissionContextFrom(membership), query);
  }

  @Get(':templateId')
  @ApiOkResponse({ description: 'Template.', type: Template })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('templateId', ParseObjectIdPipe) templateId: Types.ObjectId,
  ): Promise<TemplateDocument> {
    return this.templates.get(permissionContextFrom(membership), templateId);
  }

  @Post(':templateId/apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Template aplicado no local; ids novos e datas recalculadas.',
  })
  apply(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Param('templateId', ParseObjectIdPipe) templateId: Types.ObjectId,
    @Body() dto: ApplyTemplateDto,
  ): Promise<AppliedTemplate> {
    return this.templates.apply(
      permissionContextFrom(membership),
      templateId,
      workspace.taskPrefix,
      dto,
    );
  }

  @Delete(':templateId')
  @Roles('member')
  @ApiOkResponse({ description: 'Template excluído.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('templateId', ParseObjectIdPipe) templateId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.templates.remove(permissionContextFrom(membership), templateId);

    return { success: true };
  }
}
