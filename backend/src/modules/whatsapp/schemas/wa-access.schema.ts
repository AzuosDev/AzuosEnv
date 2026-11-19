import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { WA_ACCESS_LEVELS, WaAccessLevel } from '../whatsapp-fields';

/**
 * Permission of the whatsapp module, per member. Owner and admin are always
 * `gestor` and have no row here; everybody else only sees the module after the
 * admin grants a level.
 */
@Schema({ collection: 'wa_access', ...baseSchemaOptions })
export class WaAccess {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: WA_ACCESS_LEVELS, required: true })
  level: WaAccessLevel;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  grantedBy: Types.ObjectId;
}

export type WaAccessDocument = HydratedDocument<WaAccess>;

export const WaAccessSchema = SchemaFactory.createForClass(WaAccess);

WaAccessSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
