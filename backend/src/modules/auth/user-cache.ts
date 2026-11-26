import { TtlCache } from '../../common/cache/ttl-cache';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Janela em que o usuário do access token é reaproveitado sem ir ao banco. O
 * token é curto e o perfil muda pouco; quem muda o perfil chama
 * `forgetCachedUser` e a troca vale na hora. Vive aqui, fora da strategy, para
 * o UsersService poder invalidar sem import circular.
 */
const USER_CACHE_TTL_MS = 30_000;

const cache = new TtlCache<AuthenticatedUser>(USER_CACHE_TTL_MS);

export function cachedUser(userId: string): AuthenticatedUser | undefined {
  return cache.get(userId);
}

export function cacheUser(userId: string, user: AuthenticatedUser): void {
  cache.set(userId, user);
}

export function forgetCachedUser(userId?: string): void {
  if (userId) {
    cache.delete(userId);

    return;
  }

  cache.clear();
}
