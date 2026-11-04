import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { DOC_LOCATION_TYPES, DocLocationType } from '../docs-fields';

/** Public read-only link of the Doc; the token is stored only as a sha256. */
@Schema({ _id: false })
export class DocShare {
  @Prop({ type: Boolean, default: false })
  public: boolean;

  /** sha256 of the opaque token; the plain value is shown once, on sharing. */
  @Prop({ type: String, default: null, select: false })
  tokenHash: string | null;
}

export const DocShareSchema = SchemaFactory.createForClass(DocShare);

@Schema({ collection: 'docs', ...baseSchemaOptions })
export class Doc {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: DOC_LOCATION_TYPES, required: true })
  locationType: DocLocationType;

  /** null only when `locationType` is `workspace`. */
  @Prop({ type: Types.ObjectId, default: null })
  locationId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, default: null })
  icon: string | null;

  /** Private Docs are invisible to everyone but the author. */
  @Prop({ type: Boolean, default: false })
  private: boolean;

  /** A wiki Doc is the reference of its location. */
  @Prop({ type: Boolean, default: false })
  isWiki: boolean;

  @Prop({ type: DocShareSchema, default: () => ({ public: false, tokenHash: null }) })
  share: DocShare;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type DocDocument = HydratedDocument<Doc>;

export const DocSchema = SchemaFactory.createForClass(Doc);

DocSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;

    const share = plain.share as Record<string, unknown> | undefined;

    if (share) {
      delete share.tokenHash;
    }

    return plain;
  },
});

DocSchema.index({ workspaceId: 1, locationType: 1, locationId: 1, _id: -1 });
DocSchema.index({ workspaceId: 1, deletedAt: 1, _id: -1 });
DocSchema.index({ 'share.tokenHash': 1 });
