import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Readable } from 'node:stream';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { StorageService } from '../storage/storage.service';
import { AttachmentEntityType, MAX_UPLOAD_BYTES, isAllowedMimeType } from './collaboration-fields';
import { CommentsService } from './comments.service';
import { Attachment, AttachmentDocument } from './schemas/attachment.schema';

/** The parts of the multipart file the service needs. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface AttachmentDownload {
  attachment: AttachmentDocument;
  stream: Readable;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectModel(Attachment.name) private readonly model: Model<Attachment>,
    private readonly taskAccess: TaskAccessService,
    private readonly comments: CommentsService,
    private readonly storage: StorageService,
  ) {}

  async uploadToTask(
    ctx: PermissionContext,
    idOrCustomId: string,
    file: UploadedFile | undefined,
  ): Promise<AttachmentDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');

    return this.store(ctx, 'task', task._id, task._id, file);
  }

  /** Files of a comment are uploaded by its author. */
  async uploadToComment(
    ctx: PermissionContext,
    commentId: Types.ObjectId,
    file: UploadedFile | undefined,
  ): Promise<AttachmentDocument> {
    const { comment, task } = await this.comments.requireComment(ctx, commentId, 'comment');

    this.comments.requireAuthor(ctx, comment);

    return this.store(ctx, 'comment', comment._id, task._id, file);
  }

  async listForTask(ctx: PermissionContext, idOrCustomId: string): Promise<AttachmentDocument[]> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view');

    return this.model
      .find({ workspaceId: ctx.workspaceId, taskId: task._id })
      .sort({ _id: 1 })
      .exec();
  }

  /** The only way to read the bytes; without permission on the task it is a 404. */
  async download(
    ctx: PermissionContext,
    attachmentId: Types.ObjectId,
  ): Promise<AttachmentDownload> {
    const attachment = await this.model
      .findOne({ _id: attachmentId, workspaceId: ctx.workspaceId })
      .select('+storageKey')
      .exec();

    if (!attachment) {
      throw this.attachmentNotFound();
    }

    await this.requireTaskOf(ctx, attachment, 'view');

    return { attachment, stream: await this.storage.read(attachment.storageKey) };
  }

  /** Definitive deletion: the row and the stored file go away together. */
  async remove(ctx: PermissionContext, attachmentId: Types.ObjectId): Promise<void> {
    const attachment = await this.model
      .findOne({ _id: attachmentId, workspaceId: ctx.workspaceId })
      .select('+storageKey')
      .exec();

    if (!attachment) {
      throw this.attachmentNotFound();
    }

    await this.requireTaskOf(
      ctx,
      attachment,
      String(attachment.uploadedBy) === String(ctx.userId) ? 'view' : 'full',
    );

    await this.model.deleteOne({ _id: attachment._id, workspaceId: ctx.workspaceId }).exec();
    await this.storage.remove(attachment.storageKey);
  }

  private async store(
    ctx: PermissionContext,
    entityType: AttachmentEntityType,
    entityId: Types.ObjectId,
    taskId: Types.ObjectId,
    file: UploadedFile | undefined,
  ): Promise<AttachmentDocument> {
    const upload = this.requireFile(file);
    const stored = await this.storage.save({
      workspaceId: String(ctx.workspaceId),
      filename: upload.originalname,
      mimeType: upload.mimetype,
      buffer: upload.buffer,
    });

    return this.model.create({
      workspaceId: ctx.workspaceId,
      entityType,
      entityId,
      taskId,
      name: upload.originalname,
      mimeType: upload.mimetype,
      size: stored.size,
      storageKey: stored.key,
      uploadedBy: ctx.userId,
    });
  }

  private requireFile(file: UploadedFile | undefined): UploadedFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Envie um arquivo no campo file.',
      });
    }

    if (file.buffer.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo excede 25 MB.',
      });
    }

    if (!isAllowedMimeType(file.mimetype)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Tipo de arquivo não permitido.',
      });
    }

    return file;
  }

  private async requireTaskOf(
    ctx: PermissionContext,
    attachment: AttachmentDocument,
    required: 'view' | 'full',
  ): Promise<void> {
    await this.taskAccess.requireTask(ctx, String(attachment.taskId), required);
  }

  private attachmentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ATTACHMENT_NOT_FOUND',
      message: 'Anexo não encontrado.',
    });
  }
}
