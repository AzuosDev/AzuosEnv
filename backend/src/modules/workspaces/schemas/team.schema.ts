import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

@Schema({ collection: 'teams', ...baseSchemaOptions })
export class Team {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  memberIds: Types.ObjectId[];
}

export type TeamDocument = HydratedDocument<Team>;

export const TeamSchema = SchemaFactory.createForClass(Team);
