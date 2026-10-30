import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  PERMISSION_LEVELS,
  PERMISSION_RESOURCE_TYPES,
  PRINCIPAL_TYPES,
  PermissionLevel,
  PermissionResourceType,
  PrincipalType,
} from '../permission-levels';

@Schema({ collection: 'permissions', ...baseSchemaOptions })
export class Permission {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: PERMISSION_RESOURCE_TYPES, required: true })
  resourceType: PermissionResourceType;

  @Prop({ type: Types.ObjectId, required: true })
  resourceId: Types.ObjectId;

  @Prop({ type: String, enum: PRINCIPAL_TYPES, required: true })
  principalType: PrincipalType;

  @Prop({ type: Types.ObjectId, required: true })
  principalId: Types.ObjectId;

  @Prop({ type: String, enum: PERMISSION_LEVELS, required: true })
  level: PermissionLevel;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export type PermissionDocument = HydratedDocument<Permission>;

export const PermissionSchema = SchemaFactory.createForClass(Permission);

PermissionSchema.index(
  { workspaceId: 1, resourceType: 1, resourceId: 1, principalType: 1, principalId: 1 },
  { unique: true },
);
PermissionSchema.index({ workspaceId: 1, principalId: 1 });
