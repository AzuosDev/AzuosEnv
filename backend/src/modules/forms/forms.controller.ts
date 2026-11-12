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
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { FormResultDto } from './dto/form-result.dto';
import { CreateFormDto, FormQueryDto, UpdateFormDto } from './dto/form.dto';
import { FormResult, FormsService } from './forms.service';
import { Form, FormDocument } from './schemas/form.schema';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({
    description: 'Formulário criado; o token público vem uma única vez.',
    type: FormResultDto,
  })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateFormDto,
  ): Promise<FormResult> {
    return this.forms.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Form, 'Formulários visíveis do workspace.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: FormQueryDto,
  ): Promise<CursorPage<FormDocument>> {
    return this.forms.list(permissionContextFrom(membership), query);
  }

  @Get(':formId')
  @ApiOkResponse({ description: 'Formulário.', type: Form })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('formId', ParseObjectIdPipe) formId: Types.ObjectId,
  ): Promise<FormDocument> {
    return this.forms.get(permissionContextFrom(membership), formId);
  }

  @Patch(':formId')
  @Roles('member')
  @ApiOkResponse({ description: 'Formulário atualizado.', type: Form })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('formId', ParseObjectIdPipe) formId: Types.ObjectId,
    @Body() dto: UpdateFormDto,
  ): Promise<FormDocument> {
    return this.forms.update(permissionContextFrom(membership), formId, dto);
  }

  @Delete(':formId')
  @Roles('member')
  @ApiOkResponse({ description: 'Formulário excluído.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('formId', ParseObjectIdPipe) formId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.forms.remove(permissionContextFrom(membership), formId);

    return { success: true };
  }
}
