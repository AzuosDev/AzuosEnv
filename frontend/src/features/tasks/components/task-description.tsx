import { useQuery } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskDescription as TaskDescriptionJson, UpdateTaskInput } from '@/api/types';
import { membersQuery } from '@/features/settings/api';
import { queryTasks } from '../api';
import { RichTextEditor, type MentionOption } from './rich-text-editor';

/** Espera depois da última tecla antes de gravar a descrição. */
export const DESCRIPTION_DEBOUNCE_MS = 900;

export interface TaskDescriptionProps {
  wsId: string;
  value: TaskDescriptionJson;
  onSave: (body: UpdateTaskInput) => Promise<void>;
}

type SaveState = 'idle' | 'typing' | 'saving' | 'saved';

const STATE_LABEL: Record<SaveState, string> = {
  idle: '',
  typing: 'Digitando…',
  saving: 'Salvando…',
  saved: 'Salvo',
};

/**
 * Descrição da tarefa. O editor avisa cada tecla, o componente espera o debounce
 * e grava sozinho; "Salvo" aparece quando a resposta chega.
 */
export function TaskDescription({ wsId, value, onSave }: TaskDescriptionProps) {
  const members = useQuery(membersQuery(wsId));
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<UpdateTaskInput | null>(null);
  const save = useRef(onSave);

  save.current = onSave;

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const searchPeople = useCallback(
    (query: string): Promise<MentionOption[]> => {
      const text = query.trim().toLowerCase();
      const options = (members.data ?? [])
        .filter((member) => text === '' || member.userId.name.toLowerCase().includes(text))
        .slice(0, 8)
        .map((member) => ({
          id: member.userId.id,
          label: member.userId.name,
          hint: member.userId.email,
        }));

      return Promise.resolve(options);
    },
    [members.data],
  );

  const searchTasks = useCallback(
    async (query: string): Promise<MentionOption[]> => {
      const text = query.trim();

      if (text.length < 2) {
        return [];
      }

      const result = await queryTasks(wsId, { q: text, limit: 8, groupBy: 'none' });

      return (result.items ?? []).map((task) => ({
        id: task.id,
        label: task.name,
        hint: task.customId,
      }));
    },
    [wsId],
  );

  const onChange = useCallback((doc: JSONContent, text: string) => {
    const empty = text.trim() === '';

    pending.current = {
      description: empty ? null : (doc as Record<string, unknown>),
      descriptionText: text,
    };
    setState('typing');
    window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      const body = pending.current;

      if (!body) {
        return;
      }

      pending.current = null;
      setState('saving');
      void save.current(body).then(() => {
        setState('saved');
      });
    }, DESCRIPTION_DEBOUNCE_MS);
  }, []);

  return (
    <section aria-labelledby="task-description-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="task-description-heading" className="text-[12.5px] font-semibold text-muted">
          Descrição
        </h2>
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          {state === 'saved' ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : null}
          {STATE_LABEL[state]}
        </span>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <RichTextEditor
          aria-label="Descrição da tarefa"
          value={(value as JSONContent | null) ?? null}
          editable
          placeholder="Escreva a descrição… use @ para pessoas e # para tarefas"
          searchPeople={searchPeople}
          searchTasks={searchTasks}
          onChange={onChange}
        />
      </div>
    </section>
  );
}
