import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { Columns3, Download, Eye, EyeOff, MoveLeft, MoveRight } from 'lucide-react';
import { createContext, useContext, useMemo, useState } from 'react';
import type { CustomField, Task } from '@/api/types';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/toast';
import { CustomFieldInput } from '@/features/tasks/components/custom-field-input';
import {
  AssigneesPicker,
  PriorityPicker,
  StatusPicker,
} from '@/features/tasks/components/task-pickers';
import { AssigneeStack } from '@/features/tasks/components/assignee-stack';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { fieldValueOf, fieldValuesBody, withFieldValue } from '@/features/tasks/field-values';
import { flattenGroups } from '@/features/tasks/task-model';
import {
  DUE_TONE_CLASS,
  PRIORITY_LABEL,
  dueTone,
  formatDateField,
  fromDayTime,
  statusTone,
  toDayTime,
} from '@/features/tasks/task-fields';
import { durationInput, parseDuration } from '@/features/tasks/time-fields';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { StatusPill } from '@/components/ui/status-pill';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import {
  applySizing,
  canHideColumn,
  moveColumn,
  tableColumns,
  tableState,
  toggleColumn,
  withColumns,
  type TableColumnState,
} from '../table-columns';
import { exportView, type ExportFormat } from '../views-data-api';
import { LoadMoreBar, ScrollArea } from './view-parts';

/**
 * Features da TanStack Table v9 que a Tabela usa. Fica no escopo do módulo
 * porque identidade nova a cada render refaria os modelos de linha.
 */
const features = tableFeatures({
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnOrderingFeature,
});

const helper = createColumnHelper<typeof features, Task>();

/**
 * O contexto evita que as colunas dependam do `surface`, que nasce de novo a
 * cada render: as células leem daqui e as colunas ficam estáveis.
 */
const SurfaceContext = createContext<ViewSurfaceProps | null>(null);

function useSurface(): ViewSurfaceProps {
  const surface = useContext(SurfaceContext);

  if (!surface) {
    throw new Error('A célula da Tabela precisa do contexto da view.');
  }

  return surface;
}

const CELL_BUTTON =
  'flex min-h-9 w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-[13px] hover:bg-surface-2';

const CELL_INPUT =
  'h-9 w-full rounded-lg border border-transparent bg-transparent px-1.5 text-[13px] text-ink outline-none hover:bg-surface-2 focus-visible:border-accent focus-visible:bg-surface';

/** Campo de texto que só grava no Enter ou ao sair do foco. */
function CommitInput({
  label,
  value,
  disabled,
  type = 'text',
  title,
  onCommit,
}: {
  label: string;
  value: string;
  disabled: boolean;
  type?: 'text' | 'date';
  title?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  if (!editing && draft !== value) {
    setDraft(value);
  }

  return (
    <input
      type={type}
      value={draft}
      disabled={disabled}
      aria-label={label}
      title={title}
      onChange={(event) => {
        setEditing(true);
        setDraft(event.target.value);
      }}
      onBlur={() => {
        setEditing(false);

        if (draft !== value) {
          onCommit(draft);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
          setEditing(false);
          setDraft(value);
        }
      }}
      className={CELL_INPUT}
    />
  );
}

function NameCell({ task }: { task: Task }) {
  const surface = useSurface();

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId: surface.wsId, customId: task.customId }}
        aria-label={`Abrir ${task.name}`}
        className="shrink-0 text-[12px] text-muted hover:text-ink hover:underline"
      >
        ↗
      </Link>
      <CommitInput
        label={`Nome de ${task.customId}`}
        value={task.name}
        disabled={!surface.canEdit}
        onCommit={(name) => {
          if (name.trim() !== '') {
            surface.actions.patch.mutate({
              id: task.id,
              body: { name: name.trim() },
              optimistic: { name: name.trim() },
            });
          }
        }}
      />
    </div>
  );
}

function StatusCell({ task }: { task: Task }) {
  const surface = useSurface();
  const status = surface.statuses.find((item) => item.id === task.statusId);

  return (
    <StatusPicker
      statuses={surface.statuses}
      value={task.statusId}
      disabled={!surface.canEdit}
      onSelect={(statusId) => {
        const picked = surface.statuses.find((item) => item.id === statusId);

        surface.actions.patch.mutate({
          id: task.id,
          body: { statusId },
          ...(picked ? { optimistic: { statusId, statusGroup: picked.group } } : {}),
        });
      }}
    >
      <button
        type="button"
        className={CELL_BUTTON}
        aria-label={`Status de ${task.customId}: ${status?.name ?? 'sem status'}`}
      >
        <StatusPill tone={status ? statusTone(status.group, status.color) : undefined}>
          {status?.name ?? '—'}
        </StatusPill>
      </button>
    </StatusPicker>
  );
}

function AssigneesCell({ task }: { task: Task }) {
  const surface = useSurface();

  return (
    <AssigneesPicker
      members={surface.members}
      value={task.assigneeIds}
      disabled={!surface.canEdit}
      onChange={(assigneeIds) => {
        surface.actions.patch.mutate({
          id: task.id,
          body: { assigneeIds },
          optimistic: { assigneeIds },
        });
      }}
    >
      <button type="button" className={CELL_BUTTON} aria-label={`Responsáveis de ${task.customId}`}>
        <AssigneeStack ids={task.assigneeIds} members={surface.members} max={2} />
      </button>
    </AssigneesPicker>
  );
}

function DateCell({ task, field }: { task: Task; field: 'startAt' | 'dueAt' }) {
  const surface = useSurface();
  const value = field === 'startAt' ? task.startAt : task.dueAt;
  const { day, time } = toDayTime(value);

  return (
    <div className={cn(field === 'dueAt' && DUE_TONE_CLASS[dueTone(task.dueAt)])}>
      <CommitInput
        label={`${field === 'startAt' ? 'Início' : 'Prazo'} de ${task.customId}`}
        type="date"
        value={day}
        disabled={!surface.canEdit}
        onCommit={(next) => {
          const iso = fromDayTime(next, task.dueHasTime ? time : undefined);

          surface.actions.patch.mutate({
            id: task.id,
            body: { [field]: iso },
            optimistic: { [field]: iso } as Partial<Task>,
          });
        }}
        title={formatDateField(value, task.dueHasTime)}
      />
    </div>
  );
}

function EstimateCell({ task }: { task: Task }) {
  const surface = useSurface();

  return (
    <CommitInput
      label={`Estimativa de ${task.customId}`}
      value={durationInput(task.estimateMinutes)}
      disabled={!surface.canEdit}
      onCommit={(text) => {
        const trimmed = text.trim();
        const minutes = trimmed === '' ? null : parseDuration(trimmed);

        if (trimmed !== '' && minutes === null) {
          toast.error('Use 90, 90min, 1h30 ou 1:30.');

          return;
        }

        surface.actions.patch.mutate({
          id: task.id,
          body: { estimateMinutes: minutes },
          optimistic: { estimateMinutes: minutes },
        });
      }}
    />
  );
}

function PriorityCell({ task }: { task: Task }) {
  const surface = useSurface();

  return (
    <PriorityPicker
      value={task.priority}
      disabled={!surface.canEdit}
      onSelect={(priority) => {
        surface.actions.patch.mutate({
          id: task.id,
          body: { priority },
          optimistic: { priority },
        });
      }}
    >
      <button
        type="button"
        className={CELL_BUTTON}
        aria-label={`Prioridade de ${task.customId}: ${task.priority ? PRIORITY_LABEL[task.priority] : 'sem prioridade'}`}
      >
        <PriorityFlag priority={task.priority} withLabel />
      </button>
    </PriorityPicker>
  );
}

function FieldCell({ task, field }: { task: Task; field: CustomField }) {
  const surface = useSurface();
  const value = fieldValueOf(task.customFields, field.id);

  return (
    <CustomFieldInput
      wsId={surface.wsId}
      field={field}
      value={value}
      members={surface.members}
      attachments={[]}
      related={[]}
      disabled={!surface.canEdit}
      onChange={(next) => {
        surface.actions.patch.mutate({
          id: task.id,
          body: { customFields: fieldValuesBody([{ fieldId: field.id, value: next }]) },
          optimistic: { customFields: withFieldValue(task.customFields, field.id, next) },
        });
      }}
    />
  );
}

/** Define uma coluna da tabela a partir da coluna guardada na view. */
function columnDefOf(column: TableColumnState) {
  const common = { id: column.key, header: column.label, size: column.width };

  if (column.field) {
    const field = column.field;

    return helper.display({
      ...common,
      enableHiding: true,
      cell: ({ row }) => <FieldCell task={row.original} field={field} />,
    });
  }

  if (column.key === 'name') {
    return helper.display({
      ...common,
      enableHiding: false,
      cell: ({ row }) => <NameCell task={row.original} />,
    });
  }

  if (column.key === 'status') {
    return helper.display({ ...common, cell: ({ row }) => <StatusCell task={row.original} /> });
  }

  if (column.key === 'assignees') {
    return helper.display({ ...common, cell: ({ row }) => <AssigneesCell task={row.original} /> });
  }

  if (column.key === 'startAt' || column.key === 'dueAt') {
    const field = column.key;

    return helper.display({
      ...common,
      cell: ({ row }) => <DateCell task={row.original} field={field} />,
    });
  }

  if (column.key === 'estimate') {
    return helper.display({ ...common, cell: ({ row }) => <EstimateCell task={row.original} /> });
  }

  if (column.key === 'priority') {
    return helper.display({ ...common, cell: ({ row }) => <PriorityCell task={row.original} /> });
  }

  if (column.key === 'tags') {
    return helper.display({
      ...common,
      cell: ({ row }) => <TagsCell task={row.original} />,
    });
  }

  return helper.display({
    ...common,
    cell: ({ row }) => (
      <span className="px-1.5 text-[12px] text-muted">{row.original.customId}</span>
    ),
  });
}

function TagsCell({ task }: { task: Task }) {
  const surface = useSurface();
  const names = task.tagIds.map((id) => surface.tags.find((tag) => tag.id === id)?.name ?? 'tag');
  const text = names.join(', ');

  return (
    <span className="block truncate px-1.5 text-[12.5px] text-muted" title={text}>
      {text === '' ? '—' : text}
    </span>
  );
}

function ExportMenu({ surface }: { surface: ViewSurfaceProps }) {
  const [busy, setBusy] = useState(false);

  const download = (format: ExportFormat): void => {
    if (!surface.viewId) {
      return;
    }

    setBusy(true);
    void exportView(surface.wsId, surface.viewId, format)
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error, 'Não foi possível exportar a view.'));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy || !surface.viewId}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Baixar as tarefas da view</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => {
            download('csv');
          }}
        >
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            download('xlsx');
          }}
        >
          Excel (xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnsMenu({
  columns,
  surface,
}: {
  columns: TableColumnState[];
  surface: ViewSurfaceProps;
}) {
  const write = (next: TableColumnState[]): void => {
    surface.updateConfig((config) => withColumns(config, next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!surface.canEditConfig}>
          <Columns3 className="h-4 w-4" aria-hidden="true" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[60dvh] w-80 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {columns.map((column, index) => (
            <li key={column.key} className="flex min-h-11 items-center gap-1 md:min-h-9">
              <button
                type="button"
                aria-label={`${column.visible ? 'Esconder' : 'Mostrar'} a coluna ${column.label}`}
                disabled={!canHideColumn(column.key)}
                onClick={() => {
                  write(toggleColumn(columns, column.key));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
              >
                {column.visible ? (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[13px]',
                  column.visible ? 'text-body' : 'text-muted',
                )}
              >
                {column.label}
              </span>

              <button
                type="button"
                aria-label={`Mover a coluna ${column.label} para a esquerda`}
                disabled={index === 0}
                onClick={() => {
                  write(moveColumn(columns, column.key, -1));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
              >
                <MoveLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Mover a coluna ${column.label} para a direita`}
                disabled={index === columns.length - 1}
                onClick={() => {
                  write(moveColumn(columns, column.key, 1));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
              >
                <MoveRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Passo do teclado na alça de largura da coluna. */
const RESIZE_STEP = 16;

/**
 * View Tabela: TanStack Table v9 com colunas redimensionáveis, reordenáveis e
 * ocultáveis, edição por célula, campos personalizados, seleção e exportação
 * pelo endpoint da view. A rolagem horizontal fica dentro do container.
 */
export function TableView(surface: ViewSurfaceProps) {
  const columns = useMemo(
    () => tableColumns(surface.config, surface.fields),
    [surface.config, surface.fields],
  );
  const data = useMemo(() => flattenGroups(surface.groups), [surface.groups]);
  const defs = useMemo(() => helper.columns(columns.map(columnDefOf)), [columns]);
  const state = useMemo(() => tableState(columns), [columns]);

  const table = useTable({
    features,
    columns: defs,
    data,
    getRowId: (row) => row.id,
    columnResizeMode: 'onChange',
    enableColumnResizing: surface.canEditConfig,
    state,
    onColumnSizingChange: (updater) => {
      const next: ColumnSizingState =
        typeof updater === 'function' ? updater(state.columnSizing) : updater;

      surface.updateConfig((config) =>
        withColumns(config, applySizing(tableColumns(config, surface.fields), next)),
      );
    },
  });

  const visible = table.getVisibleLeafColumns();
  const width = visible.reduce((total, column) => total + column.getSize(), 0);
  const allSelected = data.length > 0 && data.every((task) => surface.selected.has(task.id));

  return (
    <SurfaceContext.Provider value={surface}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2 md:px-6">
          <p className="min-w-0 flex-1 text-[12px] text-muted">
            Edite direto na célula. A largura e a ordem das colunas ficam salvas na view.
          </p>
          <ColumnsMenu columns={columns} surface={surface} />
          <ExportMenu surface={surface} />
        </div>

        <ScrollArea label="Tabela de tarefas" className="flex-1 px-3 pb-10 md:px-6">
          <table
            className="border-separate border-spacing-0 text-[13px]"
            style={{ width: `${String(width + 44)}px`, tableLayout: 'fixed' }}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 z-10 w-11 border-b border-line bg-surface-2 p-1 text-left"
                >
                  <Checkbox
                    checked={allSelected}
                    aria-label="Selecionar todas as tarefas da página"
                    onCheckedChange={() => {
                      for (const task of data) {
                        if (allSelected === surface.selected.has(task.id)) {
                          surface.onToggleSelect(task.id);
                        }
                      }
                    }}
                  />
                </th>

                {table.getHeaderGroups().map((group) =>
                  group.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      style={{ width: `${String(header.column.getSize())}px` }}
                      className="sticky top-0 z-10 border-b border-line bg-surface-2 px-1.5 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted"
                    >
                      <span className="flex items-center gap-1">
                        <span className="min-w-0 flex-1 truncate">
                          <table.FlexRender header={header} />
                        </span>

                        {surface.canEditConfig && header.column.getCanResize() ? (
                          <button
                            type="button"
                            aria-label={`Largura da coluna ${String(header.column.columnDef.header ?? header.id)}`}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onKeyDown={(event) => {
                              const delta =
                                event.key === 'ArrowRight'
                                  ? RESIZE_STEP
                                  : event.key === 'ArrowLeft'
                                    ? -RESIZE_STEP
                                    : 0;

                              if (delta !== 0) {
                                event.preventDefault();
                                surface.updateConfig((config) => {
                                  const current = tableColumns(config, surface.fields);
                                  const size =
                                    (current.find((column) => column.key === header.id)?.width ??
                                      0) + delta;

                                  return withColumns(
                                    config,
                                    applySizing(current, { [header.id]: size }),
                                  );
                                });
                              }
                            }}
                            className={cn(
                              'hidden h-5 w-2 shrink-0 cursor-col-resize rounded bg-line hover:bg-accent md:block',
                              header.column.getIsResizing() && 'bg-accent',
                            )}
                          />
                        ) : null}
                      </span>
                    </th>
                  )),
                )}
              </tr>
            </thead>

            <tbody>
              {table.getRowModel().rows.map((row) => {
                const selected = surface.selected.has(row.original.id);

                return (
                  <tr key={row.id} className={cn(selected && 'bg-scene/40')}>
                    <td className="w-11 border-b border-line/60 p-1 align-middle">
                      <Checkbox
                        checked={selected}
                        aria-label={`Selecionar ${row.original.name}`}
                        onCheckedChange={() => {
                          surface.onToggleSelect(row.original.id);
                        }}
                      />
                    </td>

                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: `${String(cell.column.getSize())}px` }}
                        className="min-h-11 border-b border-line/60 px-0.5 py-0.5 align-middle"
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>

        <LoadMoreBar surface={surface} />
      </div>
    </SurfaceContext.Provider>
  );
}
