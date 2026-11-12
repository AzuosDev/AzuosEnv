import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { inboxCountsQuery } from '@/features/shell/api';
import { titleWithBadge } from '../notification-model';

/** Título base da aba; o contador entra na frente dele. */
const BASE_TITLE = 'Azuos Env';

/** Põe o número de não lidas no título da aba do navegador. */
export function useTitleBadge(wsId: string): void {
  const counts = useQuery(inboxCountsQuery(wsId));
  const unread = counts.data?.unread ?? 0;

  useEffect(() => {
    document.title = titleWithBadge(BASE_TITLE, unread);

    return () => {
      document.title = BASE_TITLE;
    };
  }, [unread]);
}
