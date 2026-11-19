import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Paperclip, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaQuickReply } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import {
  createWaQuickReply,
  deleteWaQuickReply,
  updateWaQuickReply,
  waQuickRepliesAdminQuery,
} from '../api';
import { WA_VARIABLES, mergeWaPages } from '../whatsapp-model';
import { WaEmpty } from './wa-empty';
import { waIconClass, waInputClass, waPrimaryClass } from './wa-form';

export interface QuickRepliesTabProps {
  wsId: string;
}

interface Draft {
  shortcut: string;
  title: string;
  text: string;
  mediaUrl: string;
  filename: string;
}

const EMPTY: Draft = { shortcut: '', title: '', text: '', mediaUrl: '', filename: '' };

const SHORTCUT = /^[a-z0-9][a-z0-9._-]{0,39}$/;

/**
 * Aba Respostas rápidas (gestor): o que a equipe alcança digitando "/" no campo
 * da conversa. O atalho é o que vai depois da barra, então ele segue a mesma
 * regra do backend: minúsculas, número, ponto, `_` e `-`.
 */
export function QuickRepliesTab({ wsId }: QuickRepliesTabProps) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const query = useInfiniteQuery(waQuickRepliesAdminQuery(wsId, term));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WaQuickReply | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  useEffect(() => {
    if (open) {
      setDraft(
        editing
          ? {
              shortcut: editing.shortcut,
              title: editing.title,
              text: editing.text,
              mediaUrl: editing.mediaUrl,
              filename: editing.filename,
            }
          : EMPTY,
      );
    }
  }, [open, editing]);

  const refresh = (): void => {
    void queryClient.invalidateQueries({
      queryKey: ['workspaces', wsId, 'whatsapp', 'quick-replies'],
    });
  };

  const save = useMutation({
    mutationFn: async (body: Draft) => {
      const payload = {
        shortcut: body.shortcut.trim().toLowerCase(),
        title: body.title.trim(),
        text: body.text,
        mediaUrl: body.mediaUrl.trim(),
        filename: body.filename.trim(),
      };

      if (editing) {
        await updateWaQuickReply(wsId, editing.id, payload);

        return;
      }

      await createWaQuickReply(wsId, payload);
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      refresh();
      toast.success('Resposta rápida salva.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (reply: WaQuickReply) => deleteWaQuickReply(wsId, reply.id),
    onSuccess: () => {
      refresh();
      toast.success('Resposta rápida removida.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const replies = mergeWaPages<WaQuickReply>(query.data?.pages);

  const submit = (): void => {
    const shortcut = draft.shortcut.trim().toLowerCase();

    if (!SHORTCUT.test(shortcut)) {
      toast.error('O atalho aceita letras minúsculas, números, ponto, _ e -.');

      return;
    }

    if (draft.title.trim() === '') {
      toast.error('A resposta rápida precisa de um título.');

      return;
    }

    if (draft.text.trim() === '' && draft.mediaUrl.trim() === '') {
      toast.error('Escreva o texto ou informe o link do arquivo.');

      return;
    }

    save.mutate(draft);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar resposta rápida</span>
          <input
            value={term}
            placeholder="Buscar por atalho, título ou texto"
            onChange={(event) => {
              setTerm(event.target.value);
            }}
            className={waInputClass}
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className={waPrimaryClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova resposta
        </button>
      </div>

      <p className="text-[13px] text-wa-muted">
        Na conversa, digite &quot;/&quot; e o atalho. As variáveis chegam resolvidas com o nome e o
        número do contato.
      </p>

      {query.isPending ? <Spinner label="Carregando as respostas rápidas" /> : null}

      {query.isError ? (
        <WaEmpty
          title="Não foi possível carregar as respostas rápidas"
          description={errorMessage(query.error)}
          icon={<AlertTriangle className="h-7 w-7" aria-hidden="true" />}
        />
      ) : null}

      {!query.isPending && !query.isError && replies.length === 0 ? (
        <WaEmpty
          title="Nenhuma resposta rápida"
          description="Guarde aqui o que a equipe repete todo dia: preço, prazo, endereço, pedido de dados."
          icon={<Zap className="h-7 w-7" aria-hidden="true" />}
        />
      ) : null}

      {replies.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-wa-line bg-wa-panel">
          {replies.map((reply) => (
            <li
              key={reply.id}
              className="flex flex-wrap items-center gap-3 border-b border-wa-line px-3 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-wa-header px-2 py-0.5 text-[12px] font-semibold text-wa-accent">
                    /{reply.shortcut}
                  </span>
                  <span className="truncate text-[14px] font-semibold text-wa-text">
                    {reply.title}
                  </span>
                  {reply.mediaUrl ? (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] text-wa-muted">
                      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                      {reply.filename || 'arquivo'}
                    </span>
                  ) : null}
                </span>
                {reply.text ? (
                  <span className="line-clamp-2 text-[13px] text-wa-muted">{reply.text}</span>
                ) : null}
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Editar /${reply.shortcut}`}
                  onClick={() => {
                    setEditing(reply);
                    setOpen(true);
                  }}
                  className={waIconClass}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover /${reply.shortcut}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(reply);
                  }}
                  className={waIconClass}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {query.hasNextPage ? (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
          className="flex h-11 items-center justify-center rounded-xl border border-wa-line text-[13px] font-semibold text-wa-text disabled:opacity-45 md:h-10"
        >
          {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);

          if (!next) {
            setEditing(null);
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="pr-10 text-base">
            {editing ? `Editar /${editing.shortcut}` : 'Nova resposta rápida'}
          </DialogTitle>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-body">Atalho</span>
              <Input
                value={draft.shortcut}
                placeholder="preco"
                autoComplete="off"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, shortcut: event.target.value }));
                }}
              />
              <span className="text-[12px] text-muted">Digitado depois da &quot;/&quot;.</span>
            </label>

            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-body">Título</span>
              <Input
                value={draft.title}
                placeholder="Tabela de preços"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, title: event.target.value }));
                }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-body">Texto</span>
            <Textarea
              rows={4}
              value={draft.text}
              placeholder="Oi, {nome}! Nossa tabela começa em R$ 2.500."
              onChange={(event) => {
                setDraft((current) => ({ ...current, text: event.target.value }));
              }}
            />
            <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              Variáveis:
              {WA_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => {
                    setDraft((current) => ({ ...current, text: `${current.text}{${variable}}` }));
                  }}
                  className="rounded-full border border-line px-2 py-0.5 text-[12px] font-semibold text-body hover:bg-surface-2 hover:text-ink"
                >
                  {`{${variable}}`}
                </button>
              ))}
            </span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-body">Link do arquivo (opcional)</span>
              <Input
                value={draft.mediaUrl}
                placeholder="https://…/tabela.pdf"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, mediaUrl: event.target.value }));
                }}
              />
            </label>

            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-body">Nome do arquivo</span>
              <Input
                value={draft.filename}
                placeholder="tabela.pdf"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, filename: event.target.value }));
                }}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button disabled={save.isPending} onClick={submit}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
