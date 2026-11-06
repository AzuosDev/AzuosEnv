import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { COMMENT_ENTITY_TYPES, CommentEntityType } from '../collaboration-fields';

/** One entry per emoji, with everyone who reacted with it. */
@Schema({ _id: false })
export class CommentReaction {
  @Prop({ required: true, trim: true })
  emoji: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  userIds: Types.ObjectId[];
}

export const CommentReactionSchema = SchemaFactory.createForClass(CommentReaction);

/** Rich text of the comment, as produced by the editor. */
export type CommentBody = Record<string, unknown> | null;

@Schema({ collection: 'comments', ...baseSchemaOptions })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: COMMENT_ENTITY_TYPES, required: true })
  entityType: CommentEntityType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entityId: Types.ObjectId;

  /** Root comment of the thread; null on the root itself. */
  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null, index: true })
  parentCommentId: Types.ObjectId | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'JSON do editor de texto rico; null quando o comentário é só texto.',
  })
  @Prop({ type: Object, default: null })
  body: CommentBody;

  @Prop({ type: String, default: '' })
  bodyText: string;

  /** Excerpt of the Doc page the comment is anchored to; null outside pages. */
  @Prop({ type: String, default: null })
  anchor: string | null;

  /** Users mentioned in `body`, extracted on every write. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentions: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assigneeId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  resolvedBy: Types.ObjectId | null;

  @Prop({ type: [CommentReactionSchema], default: [] })
  reactions: CommentReaction[];

  @Prop({ type: Date, default: null })
  editedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type CommentDocument = HydratedDocument<Comment>;

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ workspaceId: 1, entityType: 1, entityId: 1, _id: 1 });
CommentSchema.index({ workspaceId: 1, assigneeId: 1, resolvedAt: 1, _id: 1 });
CommentSchema.index({ workspaceId: 1, parentCommentId: 1, _id: 1 });

// A collection accepts a single text index; this one serves the global search.
CommentSchema.index({ bodyText: 'text' }, { name: 'comment_text', default_language: 'portuguese' });
