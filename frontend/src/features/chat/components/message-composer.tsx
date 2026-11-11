import type { JSONContent } from '@tiptap/react';
import { Paperclip, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { Attachment, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { MAX_UPLOAD_BYTES, formatBytes } from '@/features/tasks/components/attachments-section';
import { RichTextEditor } from '@/features/tasks/components/rich-text-editor';
import { useMentionSearch } from '@/features/tasks/hooks/use-mention-search';
import { uploadChannelAttachment } from '../api';
import type { MessageDraft } from '../hooks/use-messages';

export interface MessageComposerProps {
  wsId: string;
  channelId: string;
  members: WorkspaceMemberItem[];
  label: string;
  placeholder: string;
  submitLabel: string;
  /**
   * Só a conversa usa o gradiente: a regra do sinal raro pede uma única ação
   * em `signal` por vista, e com a thread aberta existem dois editores.
   */
  submitVariant?: 'signal' | 'outline';
  pending: boolean;
  /** Documento inicial, ao editar uma mensagem já publicada. */
  value?: unknown;
  /** Falso no editor de resposta e na edição: só a conversa aceita anexo. */
  withAttachments?: boolean;
  showToolbar?: boolean;
  onSubmit: (draft: MessageDraft) => void;
  onCancel?: () => void;
  /** Avisa a sala que a pessoa está escrevendo. */
  onTyping?: () => void;
}

interface Uploading {
  id: string;
  name: string;
  /** 0 a 1. */
  ratio: number;
}

/**
 * Editor da mensagem: texto rico compacto com @pessoa e #tarefa, anexos e envio
 * no Enter (Shift+Enter quebra a linha). O rascunho fica em estado local.
 */
export function MessageComposer({
  wsId,
  channelId,
  members,
  label,
  placeholder,
  submitLabel,
  submitVariant = 'outline',
  pending,
  value,
  withAttachments = false,
  showToolbar = false,
  onSubmit,
  onCancel,
  onTyping,
}: MessageComposerProps) {
  const { searchPeople, searchTasks } = useMentionSearch(wsId, members);
  const [draft, setDraft] = useState<MessageDraft | null>(null);
  const [round, setRound] = useState(0);
  const [attached, setAttached] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const empty = (draft?.bodyText ?? '').trim() === '';
  const blocked = empty && attached.length === 0;

  const submit = (): void => {
    if (blocked || pending) {
      return;
    }

    const text = (draft?.bodyText ?? '').trim();

    onSubmit({
      body: draft?.body ?? {},
      // A API exige texto: mensagem só de anexo ganha o nome do arquivo.
      bodyText: text === '' ? (attached[0]?.name ?? 'Anexo') : text,
      ...(attached.length > 0 ? { attachmentIds: attached.map((one) => one.id) } : {}),
    });
    setDraft(null);
    setAttached([]);
    // Remontar o editor é o que limpa o conteúdo publicado.
    setRound((current) => current + 1);
  };

  const upload = async (files: File[]): Promise<void> => {
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} passa de 25 MB.`);

        continue;
      }

      const id = `${file.name}:${String(Date.now())}`;

      setUploading((current) => [...current, { id, name: file.name, ratio: 0 }]);

      try {
        const attachment = await uploadChannelAttachment(wsId, channelId, file, {
          onProgress: (ratio) => {
            setUploading((current) =>
              current.map((one) => (one.id === id ? { ...one, ratio } : one)),
            );
          },
        });

        setAttached((current) => [...current, attachment]);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setUploading((current) => current.filter((one) => one.id !== id));
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5">
      <RichTextEditor
        key={round}
        aria-label={label}
        value={(value as JSONContent | null) ?? null}
        editable={!pending}
        placeholder={placeholder}
        showToolbar={showToolbar}
        className="min-h-11 md:min-h-10"
        searchPeople={searchPeople}
        searchTasks={searchTasks}
        onEnter={submit}
        onChange={(doc, text) => {
          setDraft({ body: doc as Record<string, unknown>, bodyText: text });
          onTyping?.();
        }}
      />

      {attached.length > 0 || uploading.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {attached.map((attachment) => (
            <li
              key={attachment.id}
              className="flex max-w-full items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[12px] text-body"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 truncate">{attachment.name}</span>
              <span className="shrink-0 text-muted">{formatBytes(attachment.size)}</span>
              <button
                type="button"
                aria-label={`Tirar ${attachment.name}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => {
                  setAttached((current) => current.filter((one) => one.id !== attachment.id));
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}

          {uploading.map((item) => (
            <li
              key={item.id}
              className="flex max-w-full items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[12px] text-muted"
            >
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0">{`${String(Math.round(item.ratio * 100))}%`}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2">
        {withAttachments ? (
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                void upload([...(event.target.files ?? [])]);
                event.target.value = '';
              }}
            />
            <Button
              variant="nav"
              size="icon"
              aria-label="Anexar arquivo"
              onClick={() => {
                fileInput.current?.click();
              }}
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        ) : null}

        <span className="flex-1 truncate text-[11.5px] text-muted">
          Enter envia · Shift+Enter quebra a linha
        </span>

        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}

        <Button
          variant={submitVariant}
          size="sm"
          className="min-w-11 md:min-w-0"
          disabled={blocked || pending}
          onClick={submit}
        >
          <Send className="h-4 w-4 md:hidden" aria-hidden="true" />
          <span className="hidden md:inline">{submitLabel}</span>
          <span className="sr-only md:hidden">{submitLabel}</span>
        </Button>
      </div>
    </div>
  );
}
