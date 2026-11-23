import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { buildPasswordResetEmail } from '../mail/templates/password-reset-email';
import { UsersService } from '../users/users.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { PasswordReset, PasswordResetDocument } from './schemas/password-reset.schema';

export const PASSWORD_RESET_TTL_MINUTES = 30;

/** Pedidos por conta na janela, para um e-mail conhecido não virar mail bomb. */
const EMAIL_WINDOW_MS = 15 * 60_000;
const EMAIL_LIMIT = 3;

/** Resposta única do pedido: a mesma exista ou não a conta. */
export const PASSWORD_RESET_REQUESTED_MESSAGE =
  'Se este e-mail tiver uma conta no Azuos Env, enviamos o link para redefinir a senha.';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(PasswordReset.name) private readonly model: Model<PasswordReset>,
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sem conta, sem token e sem e-mail — e o controller responde igual de todo
   * jeito. O limite por e-mail também é silencioso: um 429 aqui diria que a
   * conta existe.
   */
  async request(email: string, ip?: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return;
    }

    const recent = await this.model.countDocuments({
      userId: user._id,
      createdAt: { $gte: new Date(Date.now() - EMAIL_WINDOW_MS) },
    });

    if (recent >= EMAIL_LIMIT) {
      return;
    }

    await this.model
      .updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } })
      .exec();

    const token = randomBytes(32).toString('base64url');

    await this.model.create({
      userId: user._id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      ip,
    });

    try {
      await this.mail.send(
        buildPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl: `${this.frontendUrl()}/redefinir-senha/${token}`,
          expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
        }),
      );
    } catch (error) {
      // Falha de transporte não pode virar 500: isso revelaria a conta.
      this.logger.error(
        'Falha ao enviar o e-mail de redefinição de senha',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async isTokenValid(token: string): Promise<boolean> {
    return (await this.findUsable(token)) !== null;
  }

  /** Grava a senha nova, queima o token e encerra todas as sessões do usuário. */
  async reset(token: string, password: string): Promise<void> {
    const reset = await this.findUsable(token);

    if (!reset) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Link de redefinição inválido ou expirado. Peça um novo.',
      });
    }

    await this.usersService.replacePassword(reset.userId, password);

    reset.usedAt = new Date();
    await reset.save();

    await this.refreshTokens.revokeAllForUser(reset.userId);
  }

  private findUsable(token: string): Promise<PasswordResetDocument | null> {
    if (!token) {
      return Promise.resolve(null);
    }

    return this.model
      .findOne({ tokenHash: hashResetToken(token), usedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
  }

  private frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  }
}
