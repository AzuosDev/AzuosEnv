import { format, isThisYear, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flag, Search } from 'lucide-react';
import type { WaConversationFilter, WaConversationItem } from '@/api/types';
import { CountBadge } from '@/components/ui/count-badge';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { WA_FILTERS, botPauseUntil, contactLabel, initialsOf, previewOf } from '../whatsapp-model';

export interface ConversationListProps {
  items: WaConversationItem[];
  activeId: string | null;
  filter: WaConversationFilter;
  term: string;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onPick: (conversationId: string) => void;
  onFilter: (filter: WaConversationFilter) => void;
  onTerm: (term: string) => void;
  onLoadMore: () => void;
  /** Largura em px no desktop; no celular a lista ocupa a tela toda. */
  width?: number;
}

/** Hora do dia para hoje, dia e mês no resto do ano, data cheia fora dele. */
function stampLabel(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = parseISO(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (isToday(date)) {
    return format(date, 'HH:mm');
  }

  return format(date, isThisYear(date) ? "d 'de' MMM" : 'dd/MM/yyyy', { locale: ptBR });
}

/** Lista de conversas: busca, filtros e uma linha por conversa. */
export function ConversationList({
  items,
  activeId,
  filter,
  term,
  loading,
  hasMore,
  loadingMore,
  onPick,
  onFilter,
  onTerm,
  onLoadMore,
  width,
}: ConversationListProps) {
  return (
    <div
      style={width === undefined ? undefined : { width }}
      className={cn(
        'flex min-h-0 flex-1 flex-col bg-wa-panel lg:flex-none lg:border-r lg:border-wa-line',
        width === undefined && 'lg:w-[340px]',
      )}
    >
      <div className="shrink-0 border-b border-wa-line px-3 py-2.5">
        <label className="relative flex items-center">
          <span className="sr-only">Buscar conversa</span>
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-wa-muted"
            aria-hidden="true"
          />
          <input
            value={term}
            placeholder="Buscar por nome, número ou mensagem"
            onChange={(event) => {
              onTerm(event.target.value);
            }}
            className="h-11 w-full rounded-xl border border-wa-line bg-wa-header pl-9 pr-3 text-wa-text outline-none placeholder:text-wa-muted md:h-10"
          />
        </label>

        <div
          role="group"
          aria-label="Filtros das conversas"
          className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1"
        >
          {WA_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => {
                onFilter(item.id);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
                filter === item.id
                  ? 'border-wa-accent bg-wa-accent text-wa-panel'
                  : 'border-wa-line text-wa-muted hover:text-wa-text',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <li className="px-3 py-6">
            <Spinner label="Carregando as conversas" />
          </li>
        ) : null}

        {!loading && items.length === 0 ? (
          <li className="px-3 py-6 text-[13px] text-wa-muted">Nenhuma conversa neste filtro.</li>
        ) : null}

        {items.map((item) => {
          const paused = botPauseUntil(item.botPausedUntil);
          const name = contactLabel(item);
          const active = item.id === activeId;

          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  onPick(item.id);
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 border-b border-wa-line px-3 py-2.5 text-left hover:bg-wa-header',
                  active && 'bg-wa-header',
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent text-[13px] font-semibold text-wa-panel"
                >
                  {initialsOf(name)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-wa-text">
                      {name}
                    </span>
                    {item.priority === 'normal' ? null : (
                      <Flag
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          item.priority === 'urgent' ? 'text-danger' : 'text-warning',
                        )}
                        aria-label={item.priority === 'urgent' ? 'Urgente' : 'Alta'}
                      />
                    )}
                    <span className="shrink-0 text-[11px] text-wa-muted">
                      {stampLabel(item.lastMessageAt)}
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-wa-muted">
                      {previewOf(item.lastMessage)}
                    </span>

                    {item.mode === 'bot' && !paused ? (
                      <span className="shrink-0 rounded-full border border-wa-line px-1.5 text-[10px] font-semibold uppercase tracking-wider text-wa-accent">
                        Bot
                      </span>
                    ) : null}

                    {paused ? (
                      <span className="shrink-0 rounded-full border border-wa-line px-1.5 text-[10px] font-semibold uppercase tracking-wider text-wa-muted">
                        Bot pausado
                      </span>
                    ) : null}

                    <CountBadge
                      count={item.unreadCount}
                      tone="wa"
                      label={item.unreadCount === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}

        {hasMore ? (
          <li className="px-3 py-3">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-wa-line text-[13px] font-semibold text-wa-text disabled:opacity-45 md:h-10"
            >
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
