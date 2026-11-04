import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { ApiKeyRequest } from '../../api-keys/api-key-request';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // The Socket.IO gateway authenticates the handshake itself; passport would
    // look for an Authorization header that a WebSocket message does not have.
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const token = bearerOf(request);

    // A personal key is accepted in place of the access token on the same routes.
    if (token && ApiKeysService.looksLikeKey(token)) {
      const authenticated = await this.apiKeys.authenticate(token);

      if (!authenticated) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Chave inválida.' });
      }

      request.user = authenticated.user;
      request.apiKey = authenticated.apiKey;

      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}

function bearerOf(request: Request): string | null {
  const header = request.headers.authorization;

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return header.slice(7).trim();
}
