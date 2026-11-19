import { useQuery } from '@tanstack/react-query';
import type { WaAccessLevel } from '@/api/types';
import { myWaAccessQuery } from '../api';

export interface WaAccess {
  level: WaAccessLevel | null;
  isPending: boolean;
}

/**
 * Nível de quem está logado no módulo do WhatsApp. Sem acesso o nível é null e
 * nem o item da navegação global aparece.
 */
export function useWaAccess(wsId: string): WaAccess {
  const query = useQuery(myWaAccessQuery(wsId));

  return { level: query.data ?? null, isPending: query.isPending };
}
