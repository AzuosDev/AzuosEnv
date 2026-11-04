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
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateFormDto, FormQueryDto, UpdateFormDto } from './dto/form.dto';
import { FormResult, FormsService } from './forms.service';
import { FormDocument } from './schemas/form.schema';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Formulário criado; o token público vem uma única vez.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateFormDto,
  ): Promise<FormResult> {
    return this.forms.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Formulários visíveis do workspace.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: FormQueryDto,
  ): Promise<CursorPage<FormDocument>> {
    return this.forms.list(permissionContextFrom(membership), query);
  }

  @Get(':formId')
  @ApiOkResponse({ description: 'Formulário.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('formId', ParseObjectIdPipe) formId: Types.ObjectId,
  ): Promise<FormDocument> {
    return this.forms.get(permissionContextFrom(membership), formId);
  }

  @Patch(':formId')
  @Roles('member')
  @ApiOkResponse({ description: 'Formulário atualizado.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('formId', ParseObjectIdPipe) formId: Types.ObjectId,
    @Body() dto: UpdateFormDto,
  ): Promise<FormDocument> {
    return this.forms.update(permissionContextFrom(membership), formId, dto);
  }

  @Delete(':formId')
  @Roles('member')
  @ApiOkResponse({ description: 'Formulário excluído.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('formId', ParseObjectIdPipe) formId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.forms.remove(permissionContextFrom(membership), formId);

    return { success: true };
  }
}
