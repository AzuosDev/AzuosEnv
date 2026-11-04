import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** Rich text of the page, as produced by the editor (Tiptap/ProseMirror JSON). */
export type PageContent = Record<string, unknown> | null;

@Schema({ collection: 'doc_pages', ...baseSchemaOptions })
export class DocPage {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Doc', required: true, index: true })
  docId: Types.ObjectId;

  /** Parent page; null on the pages at the root of the Doc. */
  @Prop({ type: Types.ObjectId, ref: 'DocPage', default: null, index: true })
  parentPageId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  content: PageContent;

  /** Plain text of `content`, indexed by the global search. */
  @Prop({ type: String, default: '' })
  contentText: string;

  /** Tasks mentioned in the page, filtered on every write. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }], default: [] })
  mentionedTaskIds: Types.ObjectId[];

  @Prop({ required: true })
  position: string;

  /** Bumped on every saved change; a PATCH with another value is a conflict. */
  @Prop({ type: Number, default: 1 })
  version: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  updatedBy: Types.ObjectId;
}

export type DocPageDocument = HydratedDocument<DocPage>;

export const DocPageSchema = SchemaFactory.createForClass(DocPage);

DocPageSchema.index({ workspaceId: 1, docId: 1, parentPageId: 1, position: 1 });

// A collection accepts a single text index; this one serves the global search.
DocPageSchema.index({ contentText: 'text' }, { name: 'page_text', default_language: 'portuguese' });
