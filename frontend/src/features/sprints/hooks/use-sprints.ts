import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ListNode, SprintFolderView } from '@/api/types';
import { sprintFoldersQuery, useSprintFolderViews } from '../api';
import { currentSprintIds } from '../sprint-model';

export interface SprintsState {
  /** Pastas de sprints com as sprints de cada uma. */
  views: SprintFolderView[];
  /** Lists que são a sprint atual de alguma pasta. */
  currentIds: Set<string>;
  /** A sprint de uma List e a pasta dela, quando a List é uma sprint. */
  find: (listId: string) => { sprint: ListNode; folder: SprintFolderView } | null;
}

/**
 * Sprints do workspace. São poucas pastas, então a sidebar e a página da List
 * compartilham o mesmo cache e sabem qual List é a sprint atual.
 */
export function useSprints(wsId: string): SprintsState {
  const folders = useQuery(sprintFoldersQuery(wsId));
  const views = useSprintFolderViews(wsId, folders.data ?? []);

  return useMemo(() => {
    const currentIds = currentSprintIds(views);

    return {
      views,
      currentIds,
      find: (listId: string) => {
        for (const folder of views) {
          const sprint = folder.sprints.find((item) => item.id === listId);

          if (sprint) {
            return { sprint, folder };
          }
        }

        return null;
      },
    };
  }, [views]);
}
