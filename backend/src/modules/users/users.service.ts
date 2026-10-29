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

    Object.assign(user, dto);

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
