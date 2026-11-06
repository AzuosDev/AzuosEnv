import type { JSONContent } from '@tiptap/react';
import { useState } from 'react';
import type { WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { useMentionSearch } from '../hooks/use-mention-search';
import { RichTextEditor } from './rich-text-editor';

export interface CommentDraft {
  body: Record<string, unknown>;
  bodyText: string;
}

export interface CommentComposerProps {
  wsId: string;
  members: WorkspaceMemberItem[];
  label: string;
  placeholder: string;
  submitLabel: string;
  pending: boolean;
  /** Documento inicial, ao editar um comentário já publicado. */
  value?: unknown;
  showToolbar?: boolean;
  onSubmit: (draft: CommentDraft) => void;
  onCancel?: () => void;
}

/**
 * Editor de comentário: texto rico compacto com @pessoa e #tarefa. Ele guarda
 * o rascunho em estado local e só avisa o pai quando a pessoa publica.
 */
export function CommentComposer({
  wsId,
  members,
  label,
  placeholder,
  submitLabel,
  pending,
  value,
  showToolbar = true,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const { searchPeople, searchTasks } = useMentionSearch(wsId, members);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [round, setRound] = useState(0);
  const empty = (draft?.bodyText ?? '').trim() === '';

  const submit = (): void => {
    if (!draft || empty) {
      return;
    }

    onSubmit(draft);
    setDraft(null);
    // Remontar o editor é o que limpa o conteúdo publicado.
    setRound((current) => current + 1);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <RichTextEditor
        key={round}
        aria-label={label}
        value={(value as JSONContent | null) ?? null}
        editable={!pending}
        placeholder={placeholder}
        showToolbar={showToolbar}
        className="min-h-16"
        searchPeople={searchPeople}
        searchTasks={searchTasks}
        onChange={(doc, text) => {
          setDraft({ body: doc as Record<string, unknown>, bodyText: text });
        }}
      />

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button variant="outline" disabled={empty || pending} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
