import { ArrowUpDown, Columns3, Group, Search, User } from 'lucide-react';
import type {
  CustomField,
  EffectiveStatus,
  Tag,
  ViewConfig,
  WorkspaceMemberItem,
} from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  MAX_FIELD_COLUMNS,
  isFieldColumnVisible,
  toggleFieldColumn,
} from '@/features/tasks/field-values';
import { cn } from '@/lib/utils';
import { GROUP_BY_LABEL, GROUP_BY_OPTIONS, SORT_BY_LABEL, SORT_BY_OPTIONS } from '../view-kinds';
import { FilterPopover } from './filter-popover';

export interface ViewToolbarProps {
  config: ViewConfig;
  update: (patch: (config: ViewConfig) => ViewConfig) => void;
  /** Falso em view protegida de outra pessoa: a config fica só leitura. */
  canEdit: boolean;
  search: string;
  onSearch: (value: string) => void;
  statuses: EffectiveStatus[];
  members: WorkspaceMemberItem[];
  tags: Tag[];
  /** Campos personalizados da List: viram coluna e filtro. */
  fields: CustomField[];
}

const LOCKED = 'View protegida: só o dono altera a configuração.';

/** Toolbar da view: busca, filtros, agrupamento, ordem e os atalhos de escopo. */
export function ViewToolbar({
  config,
  update,
  canEdit,
  search,
  onSearch,
  statuses,
  members,
  tags,
  fields,
}: ViewToolbarProps) {
  const disabled = !canEdit;
  const groupBy = config.groupBy ?? 'status';
  const sortBy = config.sortBy ?? 'position';
  const me = config.filters?.me === true;

  const toggle = (key: 'showSubtasks' | 'showClosed') => () => {
    update((current) => ({ ...current, [key]: current[key] !== true }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-3 md:px-6">
      <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 md:h-10 md:max-w-80">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <label className="sr-only" htmlFor="busca-tarefas">
          Buscar tarefas
        </label>
        <input
          id="busca-tarefas"
          type="search"
          value={search}
          placeholder="Buscar tarefas e IDs…"
          onChange={(event) => {
            onSearch(event.target.value);
          }}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none"
        />
      </div>

      <FilterPopover
        config={config}
        update={update}
        disabled={disabled}
        statuses={statuses}
        members={members}
        tags={tags}
        fields={fields}
      />

      {fields.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={disabled} title={disabled ? LOCKED : ''}>
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[60dvh] w-72 overflow-y-auto">
            <fieldset className="flex flex-col gap-1">
              <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Colunas de campo
              </legend>

              {fields.map((field) => {
                const visible = isFieldColumnVisible(config, field.id);

                return (
                  <label
                    key={field.id}
                    className="flex min-h-11 items-center gap-2 text-[13px] text-body md:min-h-9"
                  >
                    <Checkbox
                      checked={visible}
                      onCheckedChange={() => {
                        update((current) => toggleFieldColumn(current, field.id));
                      }}
                    />
                    <span className="min-w-0 truncate">{field.name}</span>
                  </label>
                );
              })}

              <p className="pt-1 text-[12px] text-muted">
                Até {String(MAX_FIELD_COLUMNS)} colunas por vez, a partir de 768 px.
              </p>
            </fieldset>
          </PopoverContent>
        </Popover>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled} title={disabled ? LOCKED : ''}>
            <Group className="h-4 w-4" aria-hidden="true" />
            Agrupar: {GROUP_BY_LABEL[groupBy]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Agrupar por</DropdownMenuLabel>
          {GROUP_BY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                update((current) => ({ ...current, groupBy: option.value }));
              }}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled} title={disabled ? LOCKED : ''}>
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
            Ordenar: {SORT_BY_LABEL[sortBy]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
          {SORT_BY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                update((current) => ({ ...current, sortBy: option.value }));
              }}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={me}
        disabled={disabled}
        className={cn(me && 'border-accent text-ink')}
        onClick={() => {
          update((current) => ({
            ...current,
            filters: { ...(current.filters ?? {}), me: current.filters?.me !== true },
          }));
        }}
      >
        <User className="h-4 w-4" aria-hidden="true" />
        Eu
      </Button>

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={config.showSubtasks === true}
        disabled={disabled}
        className={cn(config.showSubtasks === true && 'border-accent text-ink')}
        onClick={toggle('showSubtasks')}
      >
        Subtarefas
      </Button>

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={config.showClosed === true}
        disabled={disabled}
        className={cn(config.showClosed === true && 'border-accent text-ink')}
        onClick={toggle('showClosed')}
      >
        Fechadas
      </Button>
    </div>
  );
}
