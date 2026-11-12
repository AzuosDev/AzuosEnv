import { SchemaOptions } from 'mongoose';

type PlainDocument = Record<string, unknown>;

function toJsonTransform(_doc: unknown, ret: PlainDocument): PlainDocument {
  if (ret._id !== undefined && ret._id !== null) {
    ret.id = String(ret._id);
  }
  delete ret._id;
  delete ret.__v;
  return ret;
}

/** Base options for every Mongoose schema in the project. */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: { virtuals: true, transform: toJsonTransform },
  toObject: { virtuals: true, transform: toJsonTransform },
};
