import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ApiKeyRequest } from '../api-key-request';
import { isReadOnlyMethod } from '../api-key-fields';

/**
 * Runs after the JwtAuthGuard: a request authenticated by a `read` key may only
 * read. A session with the access token is never touched by this guard.
 */
@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const apiKey = request.apiKey;

    if (!apiKey || apiKey.scopes.includes('write') || isReadOnlyMethod(request.method)) {
      return true;
    }

    throw new ForbiddenException({
      code: 'API_KEY_SCOPE_DENIED',
      message: 'Esta chave de API só tem permissão de leitura.',
    });
  }
}
