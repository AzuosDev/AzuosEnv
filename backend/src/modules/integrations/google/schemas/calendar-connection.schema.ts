import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../../common/schemas/base-schema-options';

/**
 * Google account one member connected in one workspace. Both tokens are encrypted
 * at rest and never leave the server.
 */
@Schema({ collection: 'calendar_connections', ...baseSchemaOptions })
export class CalendarConnection {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: 'google' })
  provider: string;

  /** Account connected, shown in the status of the integration. */
  @Prop({ type: String, default: null })
  email: string | null;

  @ApiHideProperty()
  @Prop({ required: true, select: false })
  accessToken: string;

  /** Google only hands a refresh token on the first consent. */
  @ApiHideProperty()
  @Prop({ type: String, default: null, select: false })
  refreshToken: string | null;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: String, default: 'primary' })
  calendarId: string;

  @Prop({ type: Date, default: null })
  syncedAt: Date | null;
}

export type CalendarConnectionDocument = HydratedDocument<CalendarConnection>;

export const CalendarConnectionSchema = SchemaFactory.createForClass(CalendarConnection);

CalendarConnectionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.accessToken;
    delete plain.refreshToken;

    return plain;
  },
});

CalendarConnectionSchema.index({ workspaceId: 1, userId: 1, provider: 1 }, { unique: true });
