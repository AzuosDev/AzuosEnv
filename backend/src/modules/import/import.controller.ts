import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile as UploadedFileParam,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Audit } from '../audit/audit.decorator';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { RequestMembership, workspaceObjectId } from '../workspaces/workspace-context';
import {
  ClickUpImportService,
  ImportFile,
  ImportReport,
  MAX_IMPORT_BYTES,
} from './clickup-import.service';
import { ImportClickUpDto } from './dto/import-clickup.dto';
import { ImportReportDto, WorkspaceExportResultDto } from './dto/import-result.dto';
import { WorkspaceExport, WorkspaceExportService } from './workspace-export.service';

const UPLOAD_FIELD = 'file';

@ApiTags('import')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/import')
export class ImportController {
  constructor(private readonly clickup: ClickUpImportService) {}

  @Post('clickup')
  @Roles('admin')
  @Audit('workspace.imported', 'import')
  @UseInterceptors(
    FileInterceptor(UPLOAD_FIELD, {
      limits: { fileSize: MAX_IMPORT_BYTES },
      defParamCharset: 'utf8',
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        [UPLOAD_FIELD]: { type: 'string', format: 'binary' },
        spaceId: { type: 'string' },
      },
      required: [UPLOAD_FIELD, 'spaceId'],
    },
  })
  @ApiCreatedResponse({
    description: 'Relatório da importação, com as linhas ignoradas e os ajustes feitos.',
    type: ImportReportDto,
  })
  clickupCsv(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Body() dto: ImportClickUpDto,
    @UploadedFileParam() file: ImportFile | undefined,
  ): Promise<ImportReport> {
    return this.clickup.importCsv(
      permissionContextFrom(membership),
      dto,
      workspace.taskPrefix,
      file,
    );
  }
}

@ApiTags('export')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/export')
export class ExportController {
  constructor(private readonly exporter: WorkspaceExportService) {}

  @Get()
  @Roles('admin')
  @Audit('workspace.exported', 'export')
  @ApiOkResponse({
    description: 'Workspace inteiro em JSON, sem nenhum segredo.',
    type: WorkspaceExportResultDto,
  })
  download(@CurrentMembership() membership: RequestMembership): Promise<WorkspaceExport> {
    return this.exporter.export(workspaceObjectId(membership));
  }
}
