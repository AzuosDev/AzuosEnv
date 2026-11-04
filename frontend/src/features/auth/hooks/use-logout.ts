import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { queryKeys } from '@/api/keys';
import { logout, logoutAll } from '../api';
import { setSession } from '../session';

export type LogoutScope = 'current' | 'all';

/** Sai da sessão atual ou de todos os dispositivos e volta para o login. */
export function useLogout(): UseMutationResult<void, Error, LogoutScope> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, Error, LogoutScope>({
    mutationFn: (scope) => (scope === 'all' ? logoutAll() : logout()),
    onSettled: async () => {
      // A sessão zera antes da navegação: o grupo público lê o cache no
      // beforeLoad e devolveria o usuário para o workspace.
      setSession(queryClient, null);
      await navigate({ to: '/login', replace: true });
      queryClient.removeQueries({ queryKey: queryKeys.workspaces() });
    },
  });
}
