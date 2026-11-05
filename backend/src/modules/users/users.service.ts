import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model, Types } from 'mongoose';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { escapeRegex } from '../../common/utils/regex';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

const DUPLICATE_KEY_ERROR = 11000;

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export function toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    locale: user.locale,
    theme: user.theme,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.get('createdAt') as Date | undefined,
    updatedAt: user.get('updatedAt') as Date | undefined,
  };
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    try {
      return await this.model.create({
        name: input.name,
        email: input.email,
        passwordHash: await this.hashPassword(input.password),
      });
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY_ERROR) {
        throw new ConflictException({
          code: 'EMAIL_IN_USE',
          message: 'Este e-mail já está em uso.',
        });
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  /** Accounts of the given e-mails; used by the import to match the assignees. */
  findManyByEmail(emails: string[]): Promise<UserDocument[]> {
    const wanted = [...new Set(emails.map((email) => email.trim().toLowerCase()))].filter(
      (email) => email.length > 0,
    );

    if (wanted.length === 0) {
      return Promise.resolve([]);
    }

    return this.model
      .find({ email: { $in: wanted } })
      .select('name email')
      .exec();
  }

  /** Name of each user, used for the labels of grouped task lists. */
  async namesByIds(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const docs = await this.model
      .find({ _id: { $in: ids } })
      .select('name')
      .exec();

    return new Map(docs.map((doc) => [String(doc._id), doc.name]));
  }

  /** E-mail of each user, used by the notifications that go out by mail. */
  async emailsByIds(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const docs = await this.model
      .find({ _id: { $in: ids } })
      .select('email')
      .exec();

    return new Map(docs.map((doc) => [String(doc._id), doc.email]));
  }

  /** Users among `ids` whose name or e-mail matches the term; used by the search. */
  async search(ids: Types.ObjectId[], term: string, limit: number): Promise<UserDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    const match = new RegExp(escapeRegex(term), 'i');

    return this.model
      .find({ _id: { $in: ids }, $or: [{ name: match }, { email: match }] })
      .sort({ name: 1 })
      .limit(limit)
      .exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email }).select('+passwordHash').exec();
  }

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return Promise.resolve(null);
    }
    return this.model.findById(id).exec();
  }

  async getById(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' });
    }

    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const user = await this.getById(id);

    // The DTO instance carries every optional field, so the unset ones must not overwrite.
    Object.assign(
      user,
      Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    );

    // An empty avatarUrl removes the picture: the initials take over again.
    if (dto.avatarUrl === '') {
      user.avatarUrl = undefined;
    }

    return user.save();
  }

  /** Validates the current password and stores the new hash. */
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.model.findById(id).select('+passwordHash').exec();

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' });
    }

    if (!(await this.verifyPassword(user.passwordHash, currentPassword))) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Senha atual incorreta.',
      });
    }

    user.passwordHash = await this.hashPassword(newPassword);
    await user.save();
  }

  async registerLogin(user: UserDocument): Promise<UserDocument> {
    user.lastLoginAt = new Date();
    return user.save();
  }

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
