import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { sha256Hex } from '../../common/utils/hash';
import { UsersService, toAuthenticatedUser } from '../users/users.service';
import {
  API_KEY_BYTES,
  API_KEY_HINT_LENGTH,
  API_KEY_PREFIX,
  ApiKeyScope,
  MAX_API_KEYS_PER_USER,
} from './api-key-fields';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';

export interface CreatedApiKey {
  apiKey: ApiKeyDocument;
  /** Shown only in this answer; afterwards only the hash is kept. */
  token: string;
}

/** What the guard attaches to the request when a key authenticated it. */
export interface ApiKeyPrincipal {
  id: string;
  scopes: ApiKeyScope[];
}

export interface ApiKeyAuthentication {
  user: AuthenticatedUser;
  apiKey: ApiKeyPrincipal;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel(ApiKey.name) private readonly model: Model<ApiKey>,
    private readonly users: UsersService,
  ) {}

  /** True for a bearer value that looks like one of our keys. */
  static looksLikeKey(token: string): boolean {
    return token.startsWith(API_KEY_PREFIX);
  }

  async create(userId: string, dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    const active = await this.model
      .countDocuments({ userId: new Types.ObjectId(userId), revokedAt: null })
      .exec();

    if (active >= MAX_API_KEYS_PER_USER) {
      throw new BadRequestException({
        code: 'API_KEY_LIMIT_REACHED',
        message: `Você já tem ${MAX_API_KEYS_PER_USER} chaves ativas.`,
      });
    }

    const token = `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('base64url')}`;
    const apiKey = await this.model.create({
      userId: new Types.ObjectId(userId),
      name: dto.name,
      hint: token.slice(0, API_KEY_HINT_LENGTH),
      tokenHash: sha256Hex(token),
      scopes: dto.scopes ?? ['read'],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    return { apiKey, token };
  }

  list(userId: string): Promise<ApiKeyDocument[]> {
    return this.model
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ _id: -1 })
      .exec();
  }

  async revoke(userId: string, apiKeyId: Types.ObjectId): Promise<ApiKeyDocument> {
    const apiKey = await this.model
      .findOne({ _id: apiKeyId, userId: new Types.ObjectId(userId) })
      .exec();

    if (!apiKey) {
      throw new NotFoundException({
        code: 'API_KEY_NOT_FOUND',
        message: 'Chave não encontrada.',
      });
    }

    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await apiKey.save();
    }

    return apiKey;
  }

  /**
   * Resolves the owner of the key. Returns null for an unknown, revoked or expired
   * key, so the guard answers the same 401 as an invalid JWT.
   */
  async authenticate(token: string): Promise<ApiKeyAuthentication | null> {
    const query = this.model.findOne({ tokenHash: sha256Hex(token), revokedAt: null });

    // `select` apart from the chain keeps the document type intact (Mongoose 9).
    query.select('+tokenHash');

    const apiKey = await query.exec();

    if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now())) {
      return null;
    }

    const user = await this.users.findById(String(apiKey.userId));

    if (!user) {
      return null;
    }

    // Best effort: the timestamp is informational and never fails the request.
    await this.model
      .updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } })
      .exec()
      .catch(() => undefined);

    return {
      user: toAuthenticatedUser(user),
      apiKey: { id: String(apiKey._id), scopes: apiKey.scopes },
    };
  }
}
