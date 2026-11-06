import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { UNASSIGNED_KEY } from '@/features/tasks/task-fields';
import { cn } from '@/lib/utils';
import { teamStats } from '../team-model';
import { statusDotClass } from './view-parts';

/** Quantas tarefas o cartão mostra antes de deixar o resto para a Lista. */
const PREVIEW = 4;

const TONE: Record<'doing' | 'late' | 'done', string> = {
  doing: 'text-info',
  late: 'text-danger',
  done: 'text-success',
};

/**
 * View Team: um cartão por pessoa com em andamento, atrasadas e concluídas, mais
 * as próximas tarefas dela. As contagens são das tarefas já carregadas — com
 * mais de uma página o cartão diz que o número é parcial.
 */
export function TeamView(surface: ViewSurfaceProps) {
  /**
   * Um cartão por pessoa do workspace, e não só por quem já tem tarefa: equipe
   * é equipe inteira. Quem não é mais membro, mas ainda tem tarefa, entra em
   * seguida, e "Sem responsável" fecha a lista quando existe.
   */
  const cards = useMemo(() => {
    const groupOf = (key: string) => surface.groups.find((group) => group.key === key);
    const known = new Set(surface.members.map((member) => member.userId.id));
    const people = surface.members.map((member) => ({
      key: member.userId.id,
      name: member.userId.name,
      avatarUrl: member.userId.avatarUrl,
      email: member.userId.email,
    }));
    const extra = surface.groups
      .filter((group) => !known.has(group.key))
      .map((group) => ({
        key: group.key,
        name: group.key === UNASSIGNED_KEY ? 'Sem responsável' : group.label,
        avatarUrl: undefined,
        email: undefined,
      }));

    return [...people, ...extra].map((person) => {
      const group = groupOf(person.key);
      const items = group?.items ?? [];

      return {
        ...person,
        stats: teamStats(items, (group?.nextCursor ?? null) !== null),
        items,
        cursor: group?.nextCursor ?? null,
      };
    });
  }, [surface.groups, surface.members]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-10 md:px-6">
      <p className="py-2 text-[12px] text-muted">
        Carga de cada pessoa neste local. Concluídas só contam as fechadas que a view carrega —
        ligue &quot;Fechadas&quot; na toolbar para ver todas.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <section
            key={card.key}
            aria-label={`Tarefas de ${card.name}`}
            className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <header className="flex min-w-0 items-center gap-2">
              <Avatar name={card.name} src={card.avatarUrl} className="h-9 w-9 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {card.name}
                </span>
                {card.email ? (
                  <span className="block truncate text-[11.5px] text-muted">{card.email}</span>
                ) : null}
              </span>
            </header>

            <dl className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['doing', 'Em andamento', card.stats.doing],
                  ['late', 'Atrasadas', card.stats.late],
                  ['done', 'Concluídas', card.stats.done],
                ] as const
              ).map(([tone, label, value]) => (
                <div key={label} className="rounded-lg bg-surface-2 px-1 py-1.5">
                  <dt className="text-[11px] text-muted">{label}</dt>
                  <dd className={cn('text-[17px] font-semibold', TONE[tone])}>
                    {String(value)}
                    {card.stats.partial ? <span className="text-[12px] text-muted">+</span> : null}
                  </dd>
                </div>
              ))}
            </dl>

            <ul className="flex min-w-0 flex-col gap-1">
              {card.items.slice(0, PREVIEW).map((task) => (
                <li key={task.id} className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      statusDotClass(surface, task),
                    )}
                    aria-hidden="true"
                  />
                  <Link
                    to="/w/$wsId/t/$customId"
                    params={{ wsId: surface.wsId, customId: task.customId }}
                    className="min-w-0 truncate text-body hover:text-ink hover:underline"
                  >
                    {task.name}
                  </Link>
                </li>
              ))}
              {card.items.length === 0 ? (
                <li className="text-[12px] text-muted">Nada atribuído por aqui.</li>
              ) : null}
            </ul>

            {card.cursor ? (
              <Button
                variant="nav"
                size="sm"
                disabled={surface.loadingMore}
                onClick={() => {
                  surface.onLoadMore(card.cursor ?? '');
                }}
              >
                {surface.loadingMore ? <Spinner label="Carregando" /> : 'Carregar mais'}
              </Button>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
