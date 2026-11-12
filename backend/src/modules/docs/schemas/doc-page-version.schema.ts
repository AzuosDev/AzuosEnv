import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { PageContent } from './doc-page.schema';

/** Snapshot of a page, taken at most once per window and kept up to 50 per page. */
@Schema({ collection: 'doc_page_versions', ...baseSchemaOptions })
export class DocPageVersion {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Doc', required: true, index: true })
  docId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DocPage', required: true, index: true })
  pageId: Types.ObjectId;

  /** Version of the page the snapshot holds. */
  @Prop({ type: Number, required: true })
  version: number;

  @Prop({ required: true, trim: true })
  title: string;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  content: PageContent;

  @Prop({ type: String, default: '' })
  contentText: string;

  /** Who wrote the content of the snapshot. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type DocPageVersionDocument = HydratedDocument<DocPageVersion>;

export const DocPageVersionSchema = SchemaFactory.createForClass(DocPageVersion);

DocPageVersionSchema.index({ workspaceId: 1, pageId: 1, _id: -1 });
