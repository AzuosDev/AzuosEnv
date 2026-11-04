import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
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
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { AttachmentsService, UploadedFile } from './attachments.service';
import { MAX_UPLOAD_BYTES } from './collaboration-fields';
import { Attachment, AttachmentDocument } from './schemas/attachment.schema';

const UPLOAD_FIELD = 'file';

/** Multipart with a single `file` field, capped at 25 MB, filename read as UTF-8. */
const UploadFile = () =>
  UseInterceptors(
    FileInterceptor(UPLOAD_FIELD, {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      defParamCharset: 'utf8',
    }),
  );

const UploadBody = (): MethodDecorator =>
  ApiBody({
    schema: {
      type: 'object',
      properties: { [UPLOAD_FIELD]: { type: 'string', format: 'binary' } },
      required: [UPLOAD_FIELD],
    },
  });

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tasks/:idOrCustomId/attachments')
export class TaskAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UploadFile()
  @ApiConsumes('multipart/form-data')
  @UploadBody()
  @ApiCreatedResponse({ description: 'Anexo enviado para a tarefa.', type: Attachment })
  upload(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @UploadedFileParam() file: UploadedFile | undefined,
  ): Promise<AttachmentDocument> {
    return this.attachments.uploadToTask(permissionContextFrom(membership), idOrCustomId, file);
  }

  @Get()
  @ApiOkResponse({ description: 'Anexos da tarefa e dos seus comentários.', type: [Attachment] })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<AttachmentDocument[]> {
    return this.attachments.listForTask(permissionContextFrom(membership), idOrCustomId);
  }
}

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/comments/:commentId/attachments')
export class CommentAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UploadFile()
  @ApiConsumes('multipart/form-data')
  @UploadBody()
  @ApiCreatedResponse({ description: 'Anexo enviado para o comentário.', type: Attachment })
  upload(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
    @UploadedFileParam() file: UploadedFile | undefined,
  ): Promise<AttachmentDocument> {
    return this.attachments.uploadToComment(permissionContextFrom(membership), commentId, file);
  }
}

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':attachmentId/download')
  @ApiOkResponse({ description: 'Bytes do anexo; sem permissão na tarefa responde 404.' })
  async download(
    @CurrentMembership() membership: RequestMembership,
    @Param('attachmentId', ParseObjectIdPipe) attachmentId: Types.ObjectId,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachments.download(
      permissionContextFrom(membership),
      attachmentId,
    );

    return new StreamableFile(stream, {
      type: attachment.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(attachment.name)}"`,
      length: attachment.size,
    });
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Anexo excluído definitivamente.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('attachmentId', ParseObjectIdPipe) attachmentId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.attachments.remove(permissionContextFrom(membership), attachmentId);

    return { success: true };
  }
}
