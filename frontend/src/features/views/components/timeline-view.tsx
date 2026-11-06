import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { formatDue } from '@/features/tasks/task-fields';
import { cn } from '@/lib/utils';
import {
  GANTT_SCALES,
  GANTT_SCALE_LABEL,
  NAME_COLUMN_CLASS,
  ROW_HEIGHT,
  barOf,
  ganttRange,
  todayOffset,
  type GanttScale,
} from '../gantt-model';
import { viewOption, withViewOption } from '../view-options';
import { LoadMoreBar, ScrollArea, statusDotClass } from './view-parts';

/** Altura da faixa de uma pessoa: cabeçalho + uma linha por tarefa. */
const PERSON_HEADER = 32;

/**
 * View Timeline: as mesmas barras do Gantt, mas agrupadas por responsável e sem
 * dependências. Serve para ver a sequência do trabalho de cada pessoa.
 */
export function TimelineView(surface: ViewSurfaceProps) {
  const scale = viewOption<GanttScale>(surface.config, 'timelineScale', GANTT_SCALES, 'week');
  const tasks = useMemo(() => surface.groups.flatMap((group) => group.items), [surface.groups]);
  const range = useMemo(() => ganttRange(tasks, scale), [scale, tasks]);
  const now = todayOffset(range);
  const empty = tasks.length === 0;

  const personOf = (userId: string): { name: string; avatarUrl?: string | null } | null => {
    const member = surface.members.find((item) => item.userId.id === userId);

    return member ? { name: member.userId.name, avatarUrl: member.userId.avatarUrl } : null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 md:px-6">
        <p className="min-w-0 flex-1 text-[12px] text-muted">
          Barras por responsável, de início a prazo. Para mudar as datas use o Gantt ou o painel.
        </p>
        {GANTT_SCALES.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="sm"
            aria-pressed={scale === option}
            disabled={!surface.canEditConfig}
            className={cn(scale === option && 'border-accent text-ink')}
            onClick={() => {
              surface.updateConfig((config) => withViewOption(config, 'timelineScale', option));
            }}
          >
            {GANTT_SCALE_LABEL[option]}
          </Button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto px-3 pb-10 md:px-6">
        <div className="flex min-w-0 flex-1 rounded-xl border border-line">
          <div className={cn('shrink-0 border-r border-line bg-surface', NAME_COLUMN_CLASS)}>
            <div
              className="flex items-center border-b border-line bg-surface-2 px-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted"
              style={{ height: `${String(ROW_HEIGHT)}px` }}
            >
              Responsável
            </div>

            {surface.groups.map((group) => {
              const person = personOf(group.key);

              return (
                <div key={group.key}>
                  <div
                    className="flex items-center gap-2 border-b border-line bg-paper-2 px-3"
                    style={{ height: `${String(PERSON_HEADER)}px` }}
                  >
                    {person ? (
                      <Avatar
                        name={person.name}
                        src={person.avatarUrl}
                        className="h-5 w-5 shrink-0"
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">
                      {group.label}
                    </span>
                    <span className="text-[11.5px] text-muted">{group.items.length}</span>
                  </div>

                  {group.items.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 border-b border-line/60 px-3"
                      style={{ height: `${String(ROW_HEIGHT)}px` }}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          statusDotClass(surface, task),
                        )}
                        aria-hidden="true"
                      />
                      <Link
                        to="/w/$wsId/t/$customId"
                        params={{ wsId: surface.wsId, customId: task.customId }}
                        className="min-w-0 truncate text-[13px] text-ink hover:underline"
                      >
                        {task.name}
                      </Link>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <ScrollArea label="Timeline por responsável" className="min-w-0 flex-1">
            <div style={{ width: `${String(range.width)}px` }}>
              <div
                className="flex border-b border-line bg-surface-2"
                style={{ height: `${String(ROW_HEIGHT)}px` }}
              >
                {range.columns.map((column) => (
                  <div
                    key={column.key}
                    style={{ width: `${String(column.days * range.pxPerDay)}px` }}
                    className={cn(
                      'flex shrink-0 items-center justify-center border-l border-line text-[11px]',
                      column.isNow ? 'font-semibold text-accent' : 'text-muted',
                    )}
                  >
                    {column.label}
                  </div>
                ))}
              </div>

              <div className="relative">
                {now === null ? null : (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 z-10 w-0.5 bg-accent"
                    style={{ left: `${String(now)}px`, height: '100%' }}
                  />
                )}

                {surface.groups.map((group) => (
                  <div key={group.key}>
                    <div
                      className="border-b border-line bg-paper-2"
                      style={{ height: `${String(PERSON_HEADER)}px` }}
                    />

                    {group.items.map((task) => {
                      const bar = barOf(task, range);

                      return (
                        <div
                          key={task.id}
                          className="relative border-b border-line/60"
                          style={{ height: `${String(ROW_HEIGHT)}px` }}
                        >
                          {bar ? (
                            <span
                              title={`${task.name}: ${formatDue(task.startAt)} → ${formatDue(task.dueAt, task.dueHasTime)}`}
                              className={cn(
                                'absolute top-1/2 block -translate-y-1/2 rounded-md border border-ink/20 bg-opacity-40',
                                statusDotClass(surface, task),
                                bar.milestone && 'rotate-45',
                              )}
                              style={{
                                left: `${String(bar.left)}px`,
                                width: `${String(bar.milestone ? 14 : bar.width)}px`,
                                height: `${String(bar.milestone ? 14 : 18)}px`,
                              }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {empty ? (
        <p className="px-3 pb-4 text-[13px] text-muted md:px-6">
          Nenhuma tarefa nesta view. Crie tarefas na Lista para ver a Timeline desenhar.
        </p>
      ) : null}

      <LoadMoreBar surface={surface} />
    </div>
  );
}
