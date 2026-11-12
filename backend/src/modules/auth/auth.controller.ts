import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { REFRESH_COOKIE_NAME } from './auth.constants';
import { clearRefreshCookie, setRefreshCookie } from './auth-cookies';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { AuthService, SessionSummary } from './auth.service';
import { AuthResponseDto, AuthUserDto, RegisteredUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionDto } from './dto/session.dto';
import { RefreshTokensService, RequestContext } from './refresh-tokens.service';

const CREDENTIALS_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('register')
  @ApiCreatedResponse({ description: 'Usuário criado.', type: RegisteredUserDto })
  async register(@Body() dto: RegisterDto): Promise<{ user: AuthenticatedUser }> {
    return { user: await this.authService.register(dto) };
  }

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Autenticado; refresh token no cookie.', type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const session = await this.authService.login(dto, this.contextOf(request));

    this.setRefreshCookie(response, session.refreshToken);

    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Novo access token; refresh token rotacionado.',
    type: AuthResponseDto,
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const session = await this.authService.refresh(
      this.refreshTokenOf(request),
      this.contextOf(request),
    );

    this.setRefreshCookie(response, session.refreshToken);

    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Sessão atual encerrada.', type: SuccessDto })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.authService.logout(this.refreshTokenOf(request));
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Todas as sessões do usuário encerradas.', type: SuccessDto })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.authService.logoutAll(userId);
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOkResponse({ description: 'Usuário autenticado.', type: AuthUserDto })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOkResponse({ description: 'Sessões ativas do usuário.', type: SessionDto, isArray: true })
  sessions(@CurrentUser('id') userId: string, @Req() request: Request): Promise<SessionSummary[]> {
    return this.authService.listSessions(userId, this.refreshTokenOf(request));
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Sessão encerrada.', type: SuccessDto })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) sessionId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.authService.revokeSession(userId, String(sessionId));

    return { success: true };
  }

  private contextOf(request: Request): RequestContext {
    return {
      userAgent: request.get('user-agent')?.slice(0, 255),
      ip: request.ip,
    };
  }

  private refreshTokenOf(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;

    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private setRefreshCookie(response: Response, token: string): void {
    setRefreshCookie(response, this.config, token, this.refreshTokens.ttlMs);
  }

  private clearRefreshCookie(response: Response): void {
    clearRefreshCookie(response, this.config);
  }
}
