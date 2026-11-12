import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { authCookieOptions, setRefreshCookie } from '../auth-cookies';
import { RefreshTokensService, RequestContext } from '../refresh-tokens.service';
import { GoogleLoginService } from './google-login.service';
import {
  GOOGLE_COOKIE_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_TTL_SECONDS,
} from './google-login.state';

const CALLBACK_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth/google')
export class GoogleLoginController {
  constructor(
    private readonly google: GoogleLoginService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Starts the login: stores the PKCE verifier in a cookie and goes to Google.
   * Out of the contract like the callback: both are browser redirects, not calls
   * the typed client of the front ever makes.
   */
  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async start(
    @Query('next') next: string | undefined,
    @Query('invite') invite: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const started = await this.google.start({ next, invite });

      response.cookie(GOOGLE_STATE_COOKIE, started.cookie, {
        ...authCookieOptions(this.config, GOOGLE_COOKIE_PATH),
        maxAge: GOOGLE_STATE_TTL_SECONDS * 1000,
      });
      response.redirect(started.url);
    } catch {
      response.redirect(this.google.errorUrl());
    }
  }

  /**
   * Callback of Google: opens the session in the refresh cookie and sends the
   * browser back to the front. No token ever goes in the URL.
   */
  @Public()
  @Throttle(CALLBACK_THROTTLE)
  @Get('callback')
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string> | undefined;

    response.clearCookie(GOOGLE_STATE_COOKIE, authCookieOptions(this.config, GOOGLE_COOKIE_PATH));

    try {
      const result = await this.google.callback({
        code,
        state,
        cookie: cookies?.[GOOGLE_STATE_COOKIE],
        context: this.contextOf(request),
      });

      setRefreshCookie(response, this.config, result.refreshToken, this.refreshTokens.ttlMs);
      response.redirect(this.google.successUrl(result.next));
    } catch {
      response.redirect(this.google.errorUrl());
    }
  }

  private contextOf(request: Request): RequestContext {
    return {
      userAgent: request.get('user-agent')?.slice(0, 255),
      ip: request.ip,
    };
  }
}
