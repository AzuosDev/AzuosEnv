import { useCallback, useEffect, useState } from 'react';
import { readExpanded, toggleId, withIds, writeExpanded } from '../expanded-store';

export interface ExpandedTree {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
}

/**
 * Nós abertos da árvore: lê e grava no localStorage do workspace e abre sozinho
 * os ancestrais do item ativo.
 */
export function useExpanded(wsId: string, openAlso: string[]): ExpandedTree {
  const [ids, setIds] = useState<string[]>(() => readExpanded(wsId));
  const openAlsoKey = openAlso.join(',');

  useEffect(() => {
    setIds(readExpanded(wsId));
  }, [wsId]);

  useEffect(() => {
    const ancestors = openAlsoKey ? openAlsoKey.split(',') : [];

    if (ancestors.length === 0) {
      return;
    }

    setIds((current) => {
      const next = withIds(current, ancestors);

      if (next !== current) {
        writeExpanded(wsId, next);
      }

      return next;
    });
  }, [wsId, openAlsoKey]);

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = toggleId(current, id);

        writeExpanded(wsId, next);

        return next;
      });
    },
    [wsId],
  );

  const isExpanded = useCallback((id: string) => ids.includes(id), [ids]);

  return { isExpanded, toggle };
}
