import { useCallback } from 'react';
import type { WorkspaceMemberItem } from '@/api/types';
import { queryTasks } from '../api';
import type { MentionOption } from '../components/mention-list';

export interface MentionSearches {
  /** @ busca nos membros já carregados do workspace. */
  searchPeople: (query: string) => Promise<MentionOption[]>;
  /** # busca tarefas na API a partir de duas letras. */
  searchTasks: (query: string) => Promise<MentionOption[]>;
}

/** Quantas sugestões o menu do @ e do # mostra. */
const LIMIT = 8;

/** As duas buscas do editor de texto rico, iguais na descrição e no comentário. */
export function useMentionSearch(wsId: string, members: WorkspaceMemberItem[]): MentionSearches {
  const searchPeople = useCallback(
    (query: string): Promise<MentionOption[]> => {
      const text = query.trim().toLowerCase();
      const options = members
        .filter((member) => text === '' || member.userId.name.toLowerCase().includes(text))
        .slice(0, LIMIT)
        .map((member) => ({
          id: member.userId.id,
          label: member.userId.name,
          hint: member.userId.email,
        }));

      return Promise.resolve(options);
    },
    [members],
  );

  const searchTasks = useCallback(
    async (query: string): Promise<MentionOption[]> => {
      const text = query.trim();

      if (text.length < 2) {
        return [];
      }

      const result = await queryTasks(wsId, { q: text, limit: LIMIT, groupBy: 'none' });

      return (result.items ?? []).map((task) => ({
        id: task.id,
        label: task.name,
        hint: task.customId,
      }));
    },
    [wsId],
  );

  return { searchPeople, searchTasks };
}
