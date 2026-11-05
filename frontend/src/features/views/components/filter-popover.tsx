import { Filter } from 'lucide-react';
import type { EffectiveStatus, Tag, TaskPriority, ViewConfig } from '@/api/types';
import type { WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusPill } from '@/components/ui/status-pill';
import { PRIORITY_OPTIONS, statusTone } from '@/features/tasks/task-fields';
import { activeFilterCount, clearFilters, dayToIso, isoToDay, toggleValue } from '../filters';

export interface FilterPopoverProps {
  config: ViewConfig;
  update: (patch: (config: ViewConfig) => ViewConfig) => void;
  disabled: boolean;
  statuses: EffectiveStatus[];
  members: WorkspaceMemberItem[];
  tags: Tag[];
}

const rowClass = 'flex min-h-11 items-center gap-2 text-[13px] text-body md:min-h-9';

/** Painel de filtros da view: status, responsável, prioridade, tags e datas. */
export function FilterPopover({
  config,
  update,
  disabled,
  statuses,
  members,
  tags,
}: FilterPopoverProps) {
  const filters = config.filters ?? {};
  const count = activeFilterCount(filters);

  const patchFilters = (change: (current: typeof filters) => typeof filters): void => {
    update((current) => ({ ...current, filters: change(current.filters ?? {}) }));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filtrar
          {count > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-signal">
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[70dvh] w-80 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Status
            </legend>
            {statuses.map((status) => (
              <label key={status.id} className={rowClass}>
                <Checkbox
                  checked={(filters.statusIds ?? []).includes(status.id)}
                  onCheckedChange={() => {
                    patchFilters((current) => ({
                      ...current,
                      statusIds: toggleValue(current.statusIds, status.id),
                    }));
                  }}
                />
                <StatusPill tone={statusTone(status.group, status.color)}>{status.name}</StatusPill>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Responsável
            </legend>
            <label className={rowClass}>
              <Checkbox
                checked={filters.me === true}
                onCheckedChange={(checked) => {
                  patchFilters((current) => ({ ...current, me: checked === true }));
                }}
              />
              Só as minhas
            </label>
            {members.map((member) => (
              <label key={member.id} className={rowClass}>
                <Checkbox
                  checked={(filters.assigneeIds ?? []).includes(member.userId.id)}
                  onCheckedChange={() => {
                    patchFilters((current) => ({
                      ...current,
                      assigneeIds: toggleValue(current.assigneeIds, member.userId.id),
                    }));
                  }}
                />
                <span className="truncate">{member.userId.name}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Prioridade
            </legend>
            {PRIORITY_OPTIONS.map((option) => (
              <label key={option.value} className={rowClass}>
                <Checkbox
                  checked={(filters.priority ?? []).includes(option.value)}
                  onCheckedChange={() => {
                    patchFilters((current) => ({
                      ...current,
                      priority: toggleValue<TaskPriority>(current.priority, option.value),
                    }));
                  }}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          {tags.length > 0 ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Tags
              </legend>
              {tags.map((tag) => (
                <label key={tag.id} className={rowClass}>
                  <Checkbox
                    checked={(filters.tagIds ?? []).includes(tag.id)}
                    onCheckedChange={() => {
                      patchFilters((current) => ({
                        ...current,
                        tagIds: toggleValue(current.tagIds, tag.id),
                      }));
                    }}
                  />
                  <span className="truncate">{tag.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Prazo
            </span>
            <label className="flex flex-col gap-1 text-[13px] text-body">
              De
              <input
                type="date"
                value={isoToDay(filters.dueFrom)}
                onChange={(event) => {
                  const iso = dayToIso(event.target.value, 'start');

                  patchFilters((current) => ({ ...current, dueFrom: iso }));
                }}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-ink outline-none md:h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-body">
              Até
              <input
                type="date"
                value={isoToDay(filters.dueTo)}
                onChange={(event) => {
                  const iso = dayToIso(event.target.value, 'end');

                  patchFilters((current) => ({ ...current, dueTo: iso }));
                }}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-ink outline-none md:h-10"
              />
            </label>
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() => {
              update(clearFilters);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
