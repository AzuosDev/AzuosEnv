import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

export const USER_THEMES = ['dark', 'light', 'system'] as const;
export type UserTheme = (typeof USER_THEMES)[number];

export const DEFAULT_TIMEZONE = 'America/Fortaleza';
export const DEFAULT_LOCALE = 'pt-BR';
export const DEFAULT_THEME: UserTheme = 'dark';

@Schema({ collection: 'users', ...baseSchemaOptions })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @ApiHideProperty()
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: DEFAULT_TIMEZONE })
  timezone: string;

  @Prop({ default: DEFAULT_LOCALE })
  locale: string;

  @Prop({ type: String, enum: USER_THEMES, default: DEFAULT_THEME })
  theme: UserTheme;

  @Prop()
  lastLoginAt?: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.passwordHash;
    return plain;
  },
});
