import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { ATTACHMENT_ENTITY_TYPES, AttachmentEntityType } from '../collaboration-fields';

@Schema({ collection: 'attachments', ...baseSchemaOptions })
export class Attachment {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: ATTACHMENT_ENTITY_TYPES, required: true })
  entityType: AttachmentEntityType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entityId: Types.ObjectId;

  /** Task the file hangs from, directly or through a comment; drives the permission. */
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ type: Number, required: true })
  size: number;

  /** Key of the StorageService; never exposed by the API. */
  @ApiHideProperty()
  @Prop({ required: true, select: false })
  storageKey: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;
}

export type AttachmentDocument = HydratedDocument<Attachment>;

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

AttachmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.storageKey;
    return plain;
  },
});

AttachmentSchema.index({ workspaceId: 1, taskId: 1, _id: 1 });
AttachmentSchema.index({ workspaceId: 1, entityType: 1, entityId: 1, _id: 1 });
