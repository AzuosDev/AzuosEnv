import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaContact } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { createWaContact, waContactsQuery } from '../api';
import { formatWaNumber, initialsOf, mergeWaPages } from '../whatsapp-model';

export interface ContactsTabProps {
  wsId: string;
  /** Gestor cadastra contato à mão; os outros níveis só consultam. */
  canCreate: boolean;
}

function dateLabel(iso: string | null): string {
  if (!iso) {
    return '—';
  }

  const date = parseISO(iso);

  return Number.isNaN(date.getTime())
    ? '—'
    : format(date, "d 'de' MMM 'de' yyyy", { locale: ptBR });
}

/** Aba Contatos: quem já falou com o número, com busca e cadastro manual. */
export function ContactsTab({ wsId, canCreate }: ContactsTabProps) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const query = useInfiniteQuery(waContactsQuery(wsId, term));
  const [open, setOpen] = useState(false);
  const [waId, setWaId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const contacts = mergeWaPages<WaContact>(query.data?.pages);

  const create = (): void => {
    const digits = waId.replace(/\D/g, '');

    if (digits.length < 10) {
      toast.error('Informe o número com DDI e DDD, só dígitos.');

      return;
    }

    setSaving(true);
    void createWaContact(wsId, {
      waId: digits,
      ...(name.trim() === '' ? {} : { name: name.trim() }),
    })
      .then(() => {
        setOpen(false);
        setWaId('');
        setName('');
        void queryClient.invalidateQueries({
          queryKey: ['workspaces', wsId, 'whatsapp', 'contacts'],
        });
        toast.success('Contato cadastrado.');
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Buscar contato</span>
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-wa-muted"
            aria-hidden="true"
          />
          <input
            value={term}
            placeholder="Buscar por nome ou número"
            onChange={(event) => {
              setTerm(event.target.value);
            }}
            className="h-11 w-full rounded-xl border border-wa-line bg-wa-panel pl-9 pr-3 text-wa-text outline-none placeholder:text-wa-muted md:h-10"
          />
        </label>

        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            className="flex h-11 items-center gap-2 rounded-xl bg-wa-accent px-4 font-semibold text-wa-panel md:h-10"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo contato
          </button>
        ) : null}
      </div>

      {query.isPending ? <Spinner label="Carregando os contatos" /> : null}

      {!query.isPending && contacts.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-wa-muted">Nenhum contato encontrado.</p>
      ) : null}

      <ul className="flex flex-col overflow-hidden rounded-2xl border border-wa-line bg-wa-panel">
        {contacts.map((contact) => (
          <li
            key={contact.id}
            className="flex min-h-11 items-center gap-3 border-b border-wa-line px-3 py-2.5 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent text-[13px] font-semibold text-wa-panel"
            >
              {initialsOf(contact.name || contact.profileName || contact.waId)}
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-semibold text-wa-text">
                {contact.name || contact.profileName || formatWaNumber(contact.waId)}
              </span>
              <span className="truncate text-[13px] text-wa-muted">
                {formatWaNumber(contact.waId)}
                {contact.tags.length > 0 ? ` · ${contact.tags.join(', ')}` : ''}
              </span>
            </span>

            <span className="hidden shrink-0 text-right text-[12px] text-wa-muted md:block">
              <span className="block">Primeiro contato: {dateLabel(contact.firstContactAt)}</span>
              <span className="block">
                Última interação: {dateLabel(contact.lastInteractionAt)}
              </span>
            </span>

            {contact.optOut ? (
              <span className="shrink-0 rounded-full border border-wa-line px-2 py-0.5 text-[11px] font-semibold text-wa-muted">
                Sem contato
              </span>
            ) : null}
          </li>
        ))}
      </ul>

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="heading pr-10 text-base">Novo contato</DialogTitle>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-body">Número (com DDI e DDD)</span>
            <Input
              value={waId}
              inputMode="numeric"
              placeholder="5531999990000"
              onChange={(event) => {
                setWaId(event.target.value);
              }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-body">Nome (opcional)</span>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button disabled={saving} onClick={create}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
