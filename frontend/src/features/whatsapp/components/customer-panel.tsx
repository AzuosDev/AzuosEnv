import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Flag, Plus, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaConversationItem, WorkspaceMemberItem } from '@/api/types';
import { SelectNative } from '@/components/ui/select-native';
import { toast } from '@/components/ui/toast';
import { updateWaContact, waConversationToLead } from '../api';
import { contactLabel, formatWaNumber } from '../whatsapp-model';
import type { WaConversationActions } from '../hooks/use-wa-conversation';

export interface CustomerPanelProps {
  wsId: string;
  conversation: WaConversationItem;
  members: WorkspaceMemberItem[];
  /** Supervisor e gestor escolhem qualquer responsável; atendente só assume. */
  canAssignOthers: boolean;
  currentUserId: string | undefined;
  actions: WaConversationActions;
  onCreateTask: () => void;
  /** Fecha o painel; no celular ele é tela cheia. */
  onClose?: () => void;
  fullScreen?: boolean;
}

function dateLabel(iso: string | null): string {
  if (!iso) {
    return '—';
  }

  const date = parseISO(iso);

  return Number.isNaN(date.getTime())
    ? '—'
    : format(date, "d 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR });
}

/** Painel do cliente: dados do contato, responsável e as pontes com a tarefa. */
export function CustomerPanel({
  wsId,
  conversation,
  members,
  canAssignOthers,
  currentUserId,
  actions,
  onCreateTask,
  onClose,
  fullScreen = false,
}: CustomerPanelProps) {
  const queryClient = useQueryClient();
  const contact = conversation.contact;
  const [name, setName] = useState(contact?.name ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(contact?.name ?? '');
    setNotes(contact?.notes ?? '');
    setTagDraft('');
  }, [contact?.id, contact?.name, contact?.notes]);

  const refresh = (): void => {
    void queryClient.invalidateQueries({
      queryKey: ['workspaces', wsId, 'whatsapp'],
    });
  };

  const save = async (patch: { name?: string; notes?: string; tags?: string[] }): Promise<void> => {
    if (!contact) {
      return;
    }

    setSaving(true);

    try {
      await updateWaContact(wsId, contact.id, patch);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const tags = contact?.tags ?? [];

  return (
    <aside
      aria-label="Painel do cliente"
      className={
        fullScreen
          ? 'flex min-h-0 flex-1 flex-col overflow-y-auto bg-wa-panel'
          : 'flex min-h-0 w-[320px] shrink-0 flex-col overflow-y-auto border-l border-wa-line bg-wa-panel'
      }
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-wa-line bg-wa-header px-2 py-2 md:px-3">
        {fullScreen && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Voltar para a conversa"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-muted hover:text-wa-text"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-wa-text">
          {contactLabel(conversation)}
        </h2>
        {!fullScreen && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar o painel do cliente"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-wa-muted hover:text-wa-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="flex flex-col gap-4 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-wa-text">Nome</span>
          <input
            value={name}
            disabled={!contact || saving}
            onChange={(event) => {
              setName(event.target.value);
            }}
            onBlur={() => {
              if (name !== (contact?.name ?? '')) {
                void save({ name });
              }
            }}
            className="h-11 w-full rounded-xl border border-wa-line bg-wa-header px-3 text-wa-text outline-none md:h-10"
          />
        </label>

        <p className="text-[13px] text-wa-muted">
          {contact ? formatWaNumber(contact.waId) : 'Contato não encontrado'}
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-wa-text">Etiquetas</span>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag}>
                <span className="flex items-center gap-1 rounded-full border border-wa-line px-2 py-1 text-[12px] text-wa-text">
                  {tag}
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={`Remover a etiqueta ${tag}`}
                    onClick={() => {
                      void save({ tags: tags.filter((item) => item !== tag) });
                    }}
                    className="text-wa-muted hover:text-wa-text"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
            {tags.length === 0 ? (
              <li className="text-[13px] text-wa-muted">Nenhuma etiqueta.</li>
            ) : null}
          </ul>

          <div className="flex gap-1.5">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Nova etiqueta</span>
              <input
                value={tagDraft}
                placeholder="Nova etiqueta"
                disabled={!contact || saving}
                onChange={(event) => {
                  setTagDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }

                  event.preventDefault();

                  const tag = tagDraft.trim();

                  if (tag !== '' && !tags.includes(tag)) {
                    void save({ tags: [...tags, tag] }).then(() => {
                      setTagDraft('');
                    });
                  }
                }}
                className="h-11 w-full rounded-xl border border-wa-line bg-wa-header px-3 text-wa-text outline-none placeholder:text-wa-muted md:h-10"
              />
            </label>
            <button
              type="button"
              disabled={!contact || saving || tagDraft.trim() === ''}
              aria-label="Adicionar etiqueta"
              onClick={() => {
                const tag = tagDraft.trim();

                if (tag !== '' && !tags.includes(tag)) {
                  void save({ tags: [...tags, tag] }).then(() => {
                    setTagDraft('');
                  });
                }
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-wa-line text-wa-text disabled:opacity-45 md:h-10 md:w-10"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-wa-text">Observações internas</span>
          <textarea
            value={notes}
            rows={3}
            disabled={!contact || saving}
            placeholder="O cliente nunca vê este texto."
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            onBlur={() => {
              if (notes !== (contact?.notes ?? '')) {
                void save({ notes });
              }
            }}
            className="w-full resize-y rounded-xl border border-wa-line bg-wa-header p-3 text-wa-text outline-none placeholder:text-wa-muted"
          />
        </label>

        <dl className="flex flex-col gap-2 border-t border-wa-line pt-3 text-[13px]">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-wa-muted">Primeiro contato</dt>
            <dd className="text-right text-wa-text">
              {dateLabel(contact?.firstContactAt ?? null)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-wa-muted">Última interação</dt>
            <dd className="text-right text-wa-text">
              {dateLabel(contact?.lastInteractionAt ?? null)}
            </dd>
          </div>
        </dl>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-wa-text">Responsável</span>
          <SelectNative
            value={conversation.assigneeId ?? ''}
            disabled={actions.pending}
            onChange={(event) => {
              void actions.assign(event.target.value === '' ? null : event.target.value);
            }}
            className="border-wa-line bg-wa-header text-wa-text"
          >
            <option value="">Na fila (sem responsável)</option>
            {canAssignOthers ? (
              members.map((member) => (
                <option key={member.userId.id} value={member.userId.id}>
                  {member.userId.name || member.userId.email}
                </option>
              ))
            ) : currentUserId ? (
              <option value={currentUserId}>Eu</option>
            ) : null}
          </SelectNative>
        </label>

        <label className="flex items-center justify-between gap-2 text-[13px]">
          <span className="flex items-center gap-1.5 font-semibold text-wa-text">
            <Flag className="h-4 w-4 text-warning" aria-hidden="true" />
            Prioritária
          </span>
          <input
            type="checkbox"
            checked={conversation.priority !== 'normal'}
            disabled={actions.pending}
            onChange={(event) => {
              void actions.priority(event.target.checked ? 'high' : 'normal');
            }}
            className="h-5 w-5 accent-[var(--wa-accent)]"
          />
        </label>

        <div className="flex flex-col gap-2 border-t border-wa-line pt-3">
          <button
            type="button"
            onClick={onCreateTask}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-wa-accent px-4 font-semibold text-wa-panel md:h-10"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar tarefa
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void waConversationToLead(wsId, conversation.id)
                .then((task) => {
                  toast.success(`Lead ${task.customId} criado.`);
                })
                .catch((error: unknown) => {
                  toast.error(errorMessage(error));
                })
                .finally(() => {
                  setSaving(false);
                });
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-wa-line px-4 font-semibold text-wa-text disabled:opacity-45 md:h-10"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Virar lead
          </button>
        </div>
      </div>
    </aside>
  );
}
