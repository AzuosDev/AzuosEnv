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
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';
import { CustomField, CustomFieldDocument } from './schemas/custom-field.schema';

@ApiTags('custom-fields')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/custom-fields')
export class CustomFieldsController {
  constructor(private readonly fields: CustomFieldsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Campo personalizado criado.', type: CustomField })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateCustomFieldDto,
  ): Promise<CustomFieldDocument> {
    return this.fields.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Campos do escopo e os herdados de cima.', type: [CustomField] })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: CustomFieldQueryDto,
  ): Promise<CustomFieldDocument[]> {
    return this.fields.list(
      permissionContextFrom(membership),
      query.scope,
      new Types.ObjectId(query.scopeId),
    );
  }

  @Get(':fieldId')
  @ApiOkResponse({ description: 'Campo personalizado.', type: CustomField })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('fieldId', ParseObjectIdPipe) fieldId: Types.ObjectId,
  ): Promise<CustomFieldDocument> {
    return this.fields.get(permissionContextFrom(membership), fieldId);
  }

  @Patch(':fieldId')
  @ApiOkResponse({ description: 'Campo atualizado.', type: CustomField })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('fieldId', ParseObjectIdPipe) fieldId: Types.ObjectId,
    @Body() dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldDocument> {
    return this.fields.update(permissionContextFrom(membership), fieldId, dto);
  }

  @Post(':fieldId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Campo reordenado no escopo.', type: CustomField })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('fieldId', ParseObjectIdPipe) fieldId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<CustomFieldDocument> {
    return this.fields.reorder(permissionContextFrom(membership), fieldId, dto);
  }

  @Delete(':fieldId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Campo excluído, com os valores das tarefas.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('fieldId', ParseObjectIdPipe) fieldId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.fields.remove(permissionContextFrom(membership), fieldId);

    return { success: true };
  }
}
