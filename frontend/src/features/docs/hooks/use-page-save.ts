import { useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { DocPage, UpdatePageInput } from '@/api/types';
import { docPageQuery, updatePage } from '../api';

/** Quanto tempo o editor espera parado antes de salvar. */
const DEBOUNCE_MS = 900;

export type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface PageDraft {
  title?: string;
  content?: JSONContent | null;
  contentText?: string;
  mentionedTaskIds?: string[];
}

export interface PageSave {
  state: SaveState;
  /** Salva sozinho depois da pausa; chamadas seguidas viram uma. */
  queue: (draft: PageDraft) => void;
  /** Recarrega a página do servidor e descarta o rascunho local. */
  reload: () => Promise<void>;
  /** Grava por cima com a versão que está no servidor. */
  overwrite: () => Promise<void>;
  /** Avisa que outra pessoa salvou esta página. */
  stale: boolean;
  dismissStale: () => void;
  markStale: () => void;
}

interface Pending {
  draft: PageDraft;
}

function toBody(draft: PageDraft, version: number): UpdatePageInput {
  const body: UpdatePageInput = { version };

  if (draft.title !== undefined) {
    body.title = draft.title;
  }

  if (draft.content !== undefined) {
    body.content = draft.content as Record<string, unknown> | null;
  }

  if (draft.contentText !== undefined) {
    body.contentText = draft.contentText;
  }

  if (draft.mentionedTaskIds !== undefined) {
    body.mentionedTaskIds = draft.mentionedTaskIds;
  }

  return body;
}

/**
 * Salvamento automático da página com `version`. O 409 do servidor para o
 * salvamento e deixa o conflito para o usuário resolver: recarregar ou
 * sobrescrever.
 */
export function usePageSave(wsId: string, page: DocPage | undefined): PageSave {
  const client = useQueryClient();
  const [state, setState] = useState<SaveState>('idle');
  const [stale, setStale] = useState(false);
  const version = useRef(page?.version ?? 1);
  const pending = useRef<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageId = page?.id;

  useEffect(() => {
    version.current = page?.version ?? 1;
  }, [page?.id, page?.version]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const send = useCallback(
    async (draft: PageDraft, withVersion: number): Promise<void> => {
      if (pageId === undefined) {
        return;
      }

      setState('saving');

      try {
        const saved = await updatePage(wsId, pageId, toBody(draft, withVersion));

        version.current = saved.version;
        pending.current = null;
        setStale(false);
        setState('saved');
        client.setQueryData(queryKeys.docPage(wsId, pageId), saved);
        void client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, String(saved.docId)) });
        void client.invalidateQueries({ queryKey: queryKeys.pageVersions(wsId, pageId) });
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === 'PAGE_VERSION_CONFLICT') {
          setState('conflict');

          return;
        }

        setState('error');
      }
    },
    [client, pageId, wsId],
  );

  const queue = useCallback(
    (draft: PageDraft) => {
      pending.current = { draft: { ...pending.current?.draft, ...draft } };

      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(() => {
        const next = pending.current;

        if (next) {
          void send(next.draft, version.current);
        }
      }, DEBOUNCE_MS);
    },
    [send],
  );

  const reload = useCallback(async () => {
    if (pageId === undefined) {
      return;
    }

    pending.current = null;
    setStale(false);
    setState('idle');
    await client.invalidateQueries({ queryKey: queryKeys.docPage(wsId, pageId) });
  }, [client, pageId, wsId]);

  const overwrite = useCallback(async () => {
    if (pageId === undefined) {
      return;
    }

    const draft = pending.current?.draft;

    if (!draft) {
      setState('idle');

      return;
    }

    const fresh = await client.fetchQuery({ ...docPageQuery(wsId, pageId), staleTime: 0 });

    await send(draft, fresh.version);
  }, [client, pageId, send, wsId]);

  return {
    state,
    queue,
    reload,
    overwrite,
    stale,
    dismissStale: () => {
      setStale(false);
    },
    markStale: () => {
      setStale(true);
    },
  };
}
