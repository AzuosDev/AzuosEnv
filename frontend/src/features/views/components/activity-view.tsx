import { useInfiniteQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Activity } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { activityLines, describeActivity } from '@/features/tasks/activity-model';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { cn } from '@/lib/utils';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTION_LABEL,
  ACTIVITY_ENTITY_OPTIONS,
  EMPTY_ACTIVITY_FILTER,
  activityFilterCount,
  filterActivities,
  type ActivityFilterState,
} from '../team-model';
import { locationActivityQuery } from '../views-data-api';

function stampOf(iso: string): { relative: string; exact: string } {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return { relative: '', exact: '' };
  }

  return {
    relative: formatDistanceToNow(date, { locale: ptBR, addSuffix: true }),
    exact: format(date, "d 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR }),
  };
}

function FilterMenu({
  filter,
  onChange,
  surface,
}: {
  filter: ActivityFilterState;
  onChange: (next: ActivityFilterState) => void;
  surface: ViewSurfaceProps;
}) {
  const count = activityFilterCount(filter);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn(count > 0 && 'border-accent text-ink')}>
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filtrar
          {count > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-[11px] text-on-signal">
              {String(count)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[60dvh] w-72 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Tipo
            </legend>
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_ENTITY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  aria-pressed={filter.entityType === option.value}
                  className={cn(filter.entityType === option.value && 'border-accent text-ink')}
                  onClick={() => {
                    onChange({ ...filter, entityType: option.value });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Ação
            </legend>
            {ACTIVITY_ACTIONS.map((action) => (
              <label
                key={action}
                className="flex min-h-11 items-center gap-2 text-[13px] text-body md:min-h-9"
              >
                <Checkbox
                  checked={filter.actions.includes(action)}
                  onCheckedChange={() => {
                    onChange({
                      ...filter,
                      actions: filter.actions.includes(action)
                        ? filter.actions.filter((item) => item !== action)
                        : [...filter.actions, action],
                    });
                  }}
                />
                {ACTIVITY_ACTION_LABEL[action]}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Pessoa
            </legend>
            {surface.members.map((member) => (
              <label
                key={member.userId.id}
                className="flex min-h-11 items-center gap-2 text-[13px] text-body md:min-h-9"
              >
                <Checkbox
                  checked={filter.actorIds.includes(member.userId.id)}
                  onCheckedChange={() => {
                    onChange({
                      ...filter,
                      actorIds: filter.actorIds.includes(member.userId.id)
                        ? filter.actorIds.filter((item) => item !== member.userId.id)
                        : [...filter.actorIds, member.userId.id],
                    });
                  }}
                />
                <span className="min-w-0 truncate">{member.userId.name}</span>
              </label>
            ))}
          </fieldset>

          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() => {
              onChange(EMPTY_ACTIVITY_FILTER);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Entry({ activity, surface }: { activity: Activity; surface: ViewSurfaceProps }) {
  const actor = surface.members.find((member) => member.userId.id === activity.actorId)?.userId;
  const stamp = stampOf(activity.createdAt);
  const resolve = (id: string): string | undefined =>
    surface.statuses.find((status) => status.id === id)?.name ??
    surface.members.find((member) => member.userId.id === id)?.userId.name ??
    surface.tags.find((tag) => tag.id === id)?.name;
  const lines = activityLines(activity, resolve);

  return (
    <li className="flex gap-3 border-b border-line/60 py-3">
      <Avatar name={actor?.name ?? '?'} src={actor?.avatarUrl} className="h-8 w-8 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] text-body">
          <span className="font-semibold text-ink">{actor?.name ?? 'Alguém'}</span>{' '}
          {describeActivity(activity, resolve)}
          <span className="text-muted" title={stamp.exact}>
            {' '}
            · {stamp.relative}
          </span>
        </p>

        {lines.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-[12.5px] text-muted">
            {lines.map((line) => (
              <li key={line.field} className="min-w-0 truncate">
                {line.label}: {line.from} → <span className="text-body">{line.to}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * View Activity: o feed do local (GET /activity), do mais recente para o mais
 * antigo. O endpoint recorta por local, então tipo, ação e pessoa são filtrados
 * sobre as páginas já carregadas.
 */
export function ActivityView(surface: ViewSurfaceProps) {
  const [filter, setFilter] = useState<ActivityFilterState>(EMPTY_ACTIVITY_FILTER);
  const feed = useInfiniteQuery(
    locationActivityQuery(surface.wsId, {
      location: surface.location,
      locationId: surface.locationId,
    }),
  );
  const items = useMemo(
    () => filterActivities(feed.data?.pages.flatMap((page) => page.items) ?? [], filter),
    [feed.data, filter],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-10 md:px-6">
      <div className="flex flex-wrap items-center gap-2 py-2">
        <p className="min-w-0 flex-1 text-[12px] text-muted">
          Tudo o que aconteceu neste local, do mais novo para o mais antigo.
        </p>
        <FilterMenu filter={filter} onChange={setFilter} surface={surface} />
      </div>

      {feed.isPending ? (
        <div className="py-6">
          <Spinner label="Carregando o histórico" />
        </div>
      ) : null}

      {feed.isError ? (
        <EmptyState
          title="Não deu para carregar o histórico"
          description="Tente de novo em instantes."
          action={
            <Button
              onClick={() => {
                void feed.refetch();
              }}
            >
              Tentar de novo
            </Button>
          }
        />
      ) : null}

      {!feed.isPending && !feed.isError && items.length === 0 ? (
        <EmptyState
          title="Nada no histórico"
          description={
            activityFilterCount(filter) > 0
              ? 'Nenhuma linha passa pelos filtros escolhidos.'
              : 'Assim que alguém mexer nas tarefas deste local, aparece aqui.'
          }
        />
      ) : null}

      <ul className="flex flex-col">
        {items.map((activity) => (
          <Entry key={activity.id} activity={activity} surface={surface} />
        ))}
      </ul>

      {feed.hasNextPage ? (
        <div className="py-3">
          <Button
            variant="nav"
            size="sm"
            disabled={feed.isFetchingNextPage}
            onClick={() => {
              void feed.fetchNextPage();
            }}
          >
            {feed.isFetchingNextPage ? <Spinner label="Carregando" /> : 'Carregar mais'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
