import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { durationToMs } from '../../common/utils/duration';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';

export interface RequestContext {
  userAgent?: string;
  ip?: string;
}

export interface IssuedRefreshToken {
  token: string;
  document: RefreshTokenDocument;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectModel(RefreshToken.name) private readonly model: Model<RefreshToken>,
    private readonly config: ConfigService,
  ) {}

  get ttlMs(): number {
    return durationToMs(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d');
  }

  async issue(
    userId: Types.ObjectId,
    context: RequestContext,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');

    const document = await this.model.create({
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + this.ttlMs),
      userAgent: context.userAgent,
      ip: context.ip,
    });

    return { token, document };
  }

  findByToken(token: string): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ tokenHash: hashRefreshToken(token) }).exec();
  }

  findById(userId: Types.ObjectId, id: Types.ObjectId): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ _id: id, userId }).exec();
  }

  /** Revokes the current token and issues a replacement within the same family. */
  async rotate(
    current: RefreshTokenDocument,
    context: RequestContext,
  ): Promise<IssuedRefreshToken> {
    const issued = await this.issue(current.userId, context, current.familyId);

    current.revokedAt = new Date();
    current.replacedById = issued.document._id;
    await current.save();

    return issued;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.model
      .updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.model
      .updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  listActive(userId: Types.ObjectId): Promise<RefreshTokenDocument[]> {
    return this.model
      .find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();
  }
}
