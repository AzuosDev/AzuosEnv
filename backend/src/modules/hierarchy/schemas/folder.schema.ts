import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** A Folder may hold subfolders, but only one level of them. */
export const MAX_FOLDER_DEPTH = 2;

@Schema({ collection: 'folders', ...baseSchemaOptions })
export class Folder {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Space', required: true, index: true })
  spaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Folder', default: null })
  parentFolderId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: false })
  private: boolean;

  @Prop({ type: Types.ObjectId, ref: 'StatusSet', default: null })
  statusSetId: Types.ObjectId | null;

  @Prop({ required: true })
  position: string;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type FolderDocument = HydratedDocument<Folder>;

export const FolderSchema = SchemaFactory.createForClass(Folder);

FolderSchema.index({ workspaceId: 1, spaceId: 1, parentFolderId: 1, deletedAt: 1, position: 1 });
