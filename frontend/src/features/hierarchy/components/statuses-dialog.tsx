import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { StatusGroup } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormAlert } from '@/features/auth/components/field';
import { treeQuery } from '@/features/shell/api';
import { crumbsOf, findLocation, type TreeCrumb } from '@/features/shell/tree-path';
import { colorSwatch } from '@/lib/colors';
import { cn } from '@/lib/utils';
import {
  createStatusSet,
  folderQuery,
  listQuery,
  spaceQuery,
  statusSetQuery,
  updateFolder,
  updateList,
  updateSpace,
  updateStatusSet,
} from '../api';
import { useTreeRefresh } from '../hooks/use-hierarchy-actions';
import { NODE_COLORS, NODE_LABEL, STATUS_GROUP_LABEL, STATUS_GROUP_ORDER } from '../node-kinds';
import {
  addStatus,
  draftFromStatuses,
  patchStatus,
  removeStatus,
  reorderStatusInGroup,
  toStatusInputs,
  validateDraft,
  type StatusDraft,
} from '../status-draft';
import type { FlatNode } from '../tree-dnd';

export interface StatusesDialogProps {
  wsId: string;
  node: FlatNode;
  addStatusOnOpen?: boolean;
  boardMode?: boolean;
  focusStatusId?: string;
  onClose: () => void;
}

function nodeQuery(wsId: string, crumb: TreeCrumb) {
  if (crumb.kind === 'space') {
    return spaceQuery(wsId, crumb.id);
  }

  return crumb.kind === 'folder' ? folderQuery(wsId, crumb.id) : listQuery(wsId, crumb.id);
}

function StatusRow({
  status,
  onChange,
  onMoveGroup,
  onRemove,
}: {
  status: StatusDraft;
  onChange: (patch: Partial<Omit<StatusDraft, 'key' | 'id'>>) => void;
  onMoveGroup: (group: StatusGroup) => void;
  onRemove: () => void;
}) {
  const sortable = useSortable({ id: status.key });

  return (
    <li
      ref={sortable.setNodeRef}
      id={status.id ? `status-row-${status.id}` : undefined}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1',
        sortable.isDragging && 'z-10 opacity-70',
      )}
    >
      <button
        type="button"
        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted hover:text-ink"
        aria-label={`Reordenar ${status.name || 'status'}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <span
          className={cn('h-3 w-3 rounded-full', colorSwatch(status.color))}
          aria-hidden="true"
        />
        <SelectNative
          aria-label={`Cor de ${status.name || 'novo status'}`}
          value={status.color}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => {
            onChange({ color: event.target.value });
          }}
        >
          {NODE_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </SelectNative>
      </div>
      <Input
        aria-label="Nome do status"
        value={status.name}
        placeholder="Nome do status"
        className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 focus-visible:border-accent"
        onChange={(event) => {
          onChange({ name: event.target.value });
        }}
      />
      <span className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="nav"
              size="icon"
              className="h-9 w-9"
              aria-label={`Opções de ${status.name || 'novo status'}`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUS_GROUP_ORDER.map((group) => (
              <DropdownMenuItem
                key={group}
                onSelect={() => {
                  onMoveGroup(group);
                }}
              >
                {status.group === group ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span className="h-4 w-4" aria-hidden="true" />
                )}
                {STATUS_GROUP_LABEL[group]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </li>
  );
}

function orderStatusesByGroup(statuses: StatusDraft[]): StatusDraft[] {
  return STATUS_GROUP_ORDER.flatMap((group) => statuses.filter((status) => status.group === group));
}

/**
 * Editor dos statuses do local: edita o conjunto quando ele é do próprio nó e,
 * quando vem do pai, oferece criar um conjunto só dele.
 */
export function StatusesDialog({
  wsId,
  node,
  addStatusOnOpen = false,
  boardMode = false,
  focusStatusId,
  onClose,
}: StatusesDialogProps) {
  const queryClient = useQueryClient();
  const refresh = useTreeRefresh(wsId);
  const tree = useQuery(treeQuery(wsId));
  const location = tree.data ? findLocation(tree.data, node.kind, node.id) : null;
  const chain = location ? crumbsOf(location) : [];
  const docs = useQueries({
    queries: chain.map((crumb) => nodeQuery(wsId, crumb)),
  });

  // Do nó para o Space: o primeiro com conjunto próprio manda nos statuses.
  const ownerIndex = [...docs]
    .map((doc, index) => ({ index, statusSetId: doc.data?.statusSetId ?? null }))
    .reverse()
    .find((entry) => entry.statusSetId !== null)?.index;
  const owner = ownerIndex === undefined ? null : (chain[ownerIndex] ?? null);
  const statusSetId =
    ownerIndex === undefined ? null : String(docs[ownerIndex]?.data?.statusSetId ?? '');
  const inherited = owner !== null && owner.id !== node.id;

  const statusSet = useQuery({
    ...statusSetQuery(wsId, statusSetId ?? ''),
    enabled: Boolean(statusSetId),
  });

  const [draft, setDraft] = useState<StatusDraft[] | null>(null);
  const [touched, setTouched] = useState(false);
  const focused = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (statusSet.data) {
      const next = orderStatusesByGroup(draftFromStatuses(statusSet.data.statuses));
      const shouldAdd = addStatusOnOpen && !inherited;

      setDraft(shouldAdd ? orderStatusesByGroup(addStatus(next)) : next);
      setTouched(shouldAdd);
    }
  }, [addStatusOnOpen, inherited, statusSet.data]);

  useEffect(() => {
    if (focusStatusId && draft && !focused.current) {
      const row = document.getElementById(`status-row-${focusStatusId}`);

      row?.scrollIntoView({ block: 'nearest' });
      row?.querySelector('input')?.focus();
      focused.current = true;
    }
  }, [draft, focusStatusId]);

  const error = draft ? validateDraft(draft) : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!draft || !statusSetId) {
        return;
      }

      await updateStatusSet(wsId, statusSetId, { statuses: toStatusInputs(draft) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.statusSet(wsId, statusSetId ?? ''),
      });
      refresh();
      toast.success(boardMode ? 'Colunas salvas.' : 'Statuses salvos.');
      onClose();
    },
  });

  const detach = useMutation({
    mutationFn: async () => {
      if (!draft) {
        return;
      }

      const created = await createStatusSet(wsId, {
        name: `${node.name} — ${boardMode ? 'colunas' : 'statuses'}`,
        statuses: toStatusInputs(draft).map(({ name, color, group }) => ({ name, color, group })),
      });

      if (node.kind === 'space') {
        await updateSpace(wsId, node.id, { statusSetId: created.id });
      } else if (node.kind === 'folder') {
        await updateFolder(wsId, node.id, { statusSetId: created.id });
      } else {
        await updateList(wsId, node.id, { statusSetId: created.id });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.space(wsId, node.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.folder(wsId, node.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.list(wsId, node.id) });
      toast.success(
        boardMode
          ? `${NODE_LABEL[node.kind]} com colunas próprias.`
          : `${NODE_LABEL[node.kind]} com statuses próprios.`,
      );
    },
  });

  const reinherit = useMutation({
    mutationFn: async () => {
      if (node.kind === 'folder') {
        await updateFolder(wsId, node.id, { statusSetId: null });
      } else if (node.kind === 'list') {
        await updateList(wsId, node.id, { statusSetId: null });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folder(wsId, node.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.list(wsId, node.id) });
      refresh();
      toast.success('Voltou a herdar os statuses do pai.');
    },
  });

  const update = (next: StatusDraft[]): void => {
    setDraft(orderStatusesByGroup(next));
    setTouched(true);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {boardMode ? `Colunas do Quadro de “${node.name}”` : `Statuses de “${node.name}”`}
          </DialogTitle>
          <DialogDescription>
            {inherited && owner
              ? `Herdando as colunas do ${NODE_LABEL[owner.kind]} “${owner.name}”.`
              : boardMode
                ? 'Cada status vira uma coluna. Edite o nome ou use as setas para mudar a ordem.'
                : 'Estes statuses valem para este local e para tudo que está dentro dele.'}
          </DialogDescription>
        </DialogHeader>

        {statusSet.isError ? <FormAlert>{errorMessage(statusSet.error)}</FormAlert> : null}
        {save.isError ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}
        {detach.isError ? <FormAlert>{errorMessage(detach.error)}</FormAlert> : null}

        {draft === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="flex flex-col gap-5 border-b border-line pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-5">
                <section className="flex flex-col gap-3">
                  <h3 className="text-[12px] font-semibold text-muted">Tipo do status</h3>
                  {node.kind === 'space' ? null : (
                    <label className="flex min-h-9 items-center gap-2 text-[13px] text-body">
                      <input
                        type="radio"
                        name={`status-source-${node.id}`}
                        checked={inherited}
                        disabled={reinherit.isPending}
                        onChange={() => {
                          if (!inherited) {
                            reinherit.mutate();
                          }
                        }}
                        className="accent-accent"
                      />
                      Herdar do pai
                    </label>
                  )}
                  <label className="flex min-h-9 items-center gap-2 text-[13px] text-body">
                    <input
                      type="radio"
                      name={`status-source-${node.id}`}
                      checked={!inherited}
                      disabled={detach.isPending}
                      onChange={() => {
                        if (inherited) {
                          detach.mutate();
                        }
                      }}
                      className="accent-accent"
                    />
                    Usar status personalizados
                  </label>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-[12px] font-semibold text-muted">Modelo de status</h3>
                  <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-[13px] text-body">
                    {statusSet.data?.name ?? 'Personalizado'}
                  </div>
                </section>

                {inherited && owner ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-muted">
                    Herdando do {NODE_LABEL[owner.kind]} “{owner.name}”.
                  </p>
                ) : null}
              </aside>

              <div className="min-w-0">
                {inherited ? (
                  <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-muted">
                    Crie um conjunto próprio para editar os status somente neste local.
                  </p>
                ) : null}

                <div
                  className={cn(
                    'flex flex-col gap-4',
                    inherited && 'pointer-events-none opacity-60',
                  )}
                >
                  {STATUS_GROUP_ORDER.map((group) => {
                    const groupStatuses = draft.filter((status) => status.group === group);

                    return (
                      <section key={group} className="flex flex-col gap-2">
                        <header className="flex items-center gap-2 px-1">
                          <span
                            className={cn(
                              'h-2.5 w-2.5 rounded-full',
                              group === 'done' || group === 'closed'
                                ? 'bg-success'
                                : group === 'active'
                                  ? 'bg-info'
                                  : 'bg-muted',
                            )}
                            aria-hidden="true"
                          />
                          <h3 className="flex-1 text-[13px] font-semibold text-body">
                            {STATUS_GROUP_LABEL[group]}
                          </h3>
                          <span className="text-[12px] text-muted">
                            {String(groupStatuses.length)}
                          </span>
                          <Button
                            variant="nav"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Adicionar status em ${STATUS_GROUP_LABEL[group]}`}
                            disabled={inherited}
                            onClick={() => {
                              update(addStatus(draft, group));
                            }}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </header>

                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event: DragEndEvent) => {
                            if (!event.over || event.active.id === event.over.id) {
                              return;
                            }

                            update(
                              reorderStatusInGroup(
                                draft,
                                group,
                                String(event.active.id),
                                String(event.over.id),
                              ),
                            );
                          }}
                        >
                          <SortableContext
                            items={groupStatuses.map((status) => status.key)}
                            strategy={verticalListSortingStrategy}
                          >
                            <ul className="flex flex-col gap-1.5">
                              {groupStatuses.map((status) => (
                                <StatusRow
                                  key={status.key}
                                  status={status}
                                  onChange={(patch) => {
                                    update(patchStatus(draft, status.key, patch));
                                  }}
                                  onMoveGroup={(nextGroup) => {
                                    update(patchStatus(draft, status.key, { group: nextGroup }));
                                  }}
                                  onRemove={() => {
                                    update(removeStatus(draft, status.key));
                                  }}
                                />
                              ))}
                            </ul>
                          </SortableContext>
                        </DndContext>

                        <button
                          type="button"
                          disabled={inherited}
                          className="flex min-h-9 items-center gap-2 rounded-lg border border-dashed border-line px-3 text-left text-[12.5px] text-muted hover:border-accent hover:text-ink disabled:pointer-events-none disabled:opacity-45"
                          onClick={() => {
                            update(addStatus(draft, group));
                          }}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          {boardMode ? 'Adicionar coluna' : 'Adicionar status'}
                        </button>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>

            {touched && error ? <FormAlert>{error}</FormAlert> : null}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                {inherited ? 'Fechar' : 'Cancelar'}
              </Button>
              {inherited ? null : (
                <Button
                  disabled={save.isPending || error !== null || !touched}
                  onClick={() => {
                    save.mutate();
                  }}
                >
                  {save.isPending ? <Spinner label="Salvando" /> : 'Aplicar alterações'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
