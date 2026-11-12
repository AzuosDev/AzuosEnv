import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UsersService, toAuthenticatedUser } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokensService, RequestContext } from './refresh-tokens.service';
import { RefreshTokenDocument } from './schemas/refresh-token.schema';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface SessionSummary {
  id: string;
  userAgent?: string;
  ip?: string;
  current: boolean;
  createdAt?: Date;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthenticatedUser> {
    const user = await this.usersService.create(dto);

    return toAuthenticatedUser(user);
  }

  async login(dto: LoginDto, context: RequestContext): Promise<AuthSession> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // An account created with Google has no password: it fails like a wrong one.
    if (!user || !(await this.usersService.verifyPassword(user.passwordHash, dto.password))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha inválidos.',
      });
    }

    return this.issueSession(user, context);
  }

  /** Opens a session for an already identified user (password login and Google login). */
  async issueSession(user: UserDocument, context: RequestContext): Promise<AuthSession> {
    await this.usersService.registerLogin(user);

    const issued = await this.refreshTokens.issue(user._id, context);

    return {
      accessToken: await this.signAccessToken(user._id, user.email),
      refreshToken: issued.token,
      user: toAuthenticatedUser(user),
    };
  }

  /** Rotates the refresh token; reusing a revoked token kills the whole family. */
  async refresh(token: string | undefined, context: RequestContext): Promise<AuthSession> {
    const current = await this.requireToken(token);

    if (current.revokedAt) {
      await this.refreshTokens.revokeFamily(current.familyId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Sessão encerrada por suspeita de reuso de token.',
      });
    }

    if (current.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Sessão expirada. Faça login novamente.',
      });
    }

    const user = await this.usersService.findById(current.userId);

    if (!user) {
      await this.refreshTokens.revokeFamily(current.familyId);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sessão inválida.',
      });
    }

    const issued = await this.refreshTokens.rotate(current, context);

    return {
      accessToken: await this.signAccessToken(user._id, user.email),
      refreshToken: issued.token,
      user: toAuthenticatedUser(user),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    const current = await this.refreshTokens.findByToken(token);

    if (current) {
      await this.refreshTokens.revokeFamily(current.familyId);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(new Types.ObjectId(userId));
  }

  async listSessions(userId: string, currentToken?: string): Promise<SessionSummary[]> {
    const current = currentToken ? await this.refreshTokens.findByToken(currentToken) : null;
    const sessions = await this.refreshTokens.listActive(new Types.ObjectId(userId));

    return sessions.map((session) => ({
      id: String(session._id),
      userAgent: session.userAgent,
      ip: session.ip,
      current: current ? session.familyId === current.familyId : false,
      createdAt: session.get('createdAt') as Date | undefined,
      expiresAt: session.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.refreshTokens.findById(
      new Types.ObjectId(userId),
      new Types.ObjectId(sessionId),
    );

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Sessão não encontrada.',
      });
    }

    await this.refreshTokens.revokeFamily(session.familyId);
  }

  private async requireToken(token: string | undefined): Promise<RefreshTokenDocument> {
    const current = token ? await this.refreshTokens.findByToken(token) : null;

    if (!current) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Token de atualização inválido.',
      });
    }

    return current;
  }

  private signAccessToken(userId: Types.ObjectId, email: string): Promise<string> {
    return this.jwtService.signAsync({ sub: String(userId), email });
  }
}
