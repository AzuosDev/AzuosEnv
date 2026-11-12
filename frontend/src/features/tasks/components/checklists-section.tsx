import { useMutation } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, CornerDownRight, Plus, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { Checklist, WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  addChecklistItem,
  createChecklist,
  deleteChecklist,
  deleteChecklistItem,
  reorderChecklist,
  reorderChecklistItem,
  updateChecklistItem,
} from '../checklists-api';
import {
  checklistProgress,
  flattenChecklist,
  moveChecklistPlan,
  moveItemPlan,
  progressPercent,
  sumProgress,
} from '../checklist-model';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';

export interface ChecklistsSectionProps {
  wsId: string;
  taskId: string;
  checklists: Checklist[];
  members: WorkspaceMemberItem[];
  onChecklist: (checklist: Checklist) => void;
  onRemoved: (checklistId: string) => void;
}

/** Barra de progresso dos itens marcados. */
function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${String(percent)}%` }} />
    </div>
  );
}

/**
 * Checklists da tarefa: várias listas, itens com um nível de subitem,
 * responsável por item, marcar, reordenar e progresso.
 */
export function ChecklistsSection({
  wsId,
  taskId,
  checklists,
  members,
  onChecklist,
  onRemoved,
}: ChecklistsSectionProps) {
  const [newList, setNewList] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<Checklist | null>(null);

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const create = useMutation({
    mutationFn: (name: string) => createChecklist(wsId, taskId, name),
    onSuccess: (checklist) => {
      setNewList('');
      onChecklist(checklist);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (checklistId: string) => deleteChecklist(wsId, checklistId),
    onSuccess: (_result, checklistId) => {
      setRemoving(null);
      onRemoved(checklistId);
    },
    onError,
  });

  const reorderList = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const plan = moveChecklistPlan(checklists, id, direction);

      return plan ? reorderChecklist(wsId, id, plan) : Promise.resolve(null);
    },
    onSuccess: (checklist) => {
      if (checklist) {
        onChecklist(checklist);
      }
    },
    onError,
  });

  const addItem = useMutation({
    mutationFn: ({
      checklistId,
      text,
      parentItemId,
    }: {
      checklistId: string;
      text: string;
      parentItemId?: string;
    }) => addChecklistItem(wsId, checklistId, { text, ...(parentItemId ? { parentItemId } : {}) }),
    onSuccess: (checklist, { checklistId }) => {
      setDrafts((current) => ({ ...current, [checklistId]: '' }));
      onChecklist(checklist);
    },
    onError,
  });

  const patchItem = useMutation({
    mutationFn: ({
      checklistId,
      itemId,
      body,
    }: {
      checklistId: string;
      itemId: string;
      body: Parameters<typeof updateChecklistItem>[3];
    }) => updateChecklistItem(wsId, checklistId, itemId, body),
    onSuccess: onChecklist,
    onError,
  });

  const removeItem = useMutation({
    mutationFn: ({ checklistId, itemId }: { checklistId: string; itemId: string }) =>
      deleteChecklistItem(wsId, checklistId, itemId),
    onSuccess: onChecklist,
    onError,
  });

  const reorderItem = useMutation({
    mutationFn: ({
      checklist,
      itemId,
      direction,
    }: {
      checklist: Checklist;
      itemId: string;
      direction: -1 | 1;
    }) => {
      const plan = moveItemPlan(checklist, itemId, direction);

      return plan ? reorderChecklistItem(wsId, checklist.id, itemId, plan) : Promise.resolve(null);
    },
    onSuccess: (checklist) => {
      if (checklist) {
        onChecklist(checklist);
      }
    },
    onError,
  });

  const total = sumProgress(checklists.map(checklistProgress));

  return (
    <section aria-labelledby="task-checklists-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="task-checklists-heading" className="text-[12.5px] font-semibold text-muted">
          Checklists
        </h2>
        {total.total > 0 ? (
          <span className="text-[12px] text-muted">
            {total.done} de {total.total}
          </span>
        ) : null}
      </div>

      {checklists.map((checklist, listIndex) => {
        const flat = flattenChecklist(checklist);
        const progress = checklistProgress(checklist);
        const percent = progressPercent(progress);

        return (
          <article
            key={checklist.id}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
          >
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                {checklist.name}
              </h3>
              <span className="shrink-0 text-[12px] text-muted">
                {progress.done}/{progress.total}
              </span>
              <Button
                variant="nav"
                size="icon"
                aria-label={`Mover checklist ${checklist.name} para cima`}
                disabled={listIndex === 0 || reorderList.isPending}
                className="h-8 w-8"
                onClick={() => {
                  reorderList.mutate({ id: checklist.id, direction: -1 });
                }}
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="nav"
                size="icon"
                aria-label={`Mover checklist ${checklist.name} para baixo`}
                disabled={listIndex === checklists.length - 1 || reorderList.isPending}
                className="h-8 w-8"
                onClick={() => {
                  reorderList.mutate({ id: checklist.id, direction: 1 });
                }}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="nav"
                size="icon"
                aria-label={`Excluir checklist ${checklist.name}`}
                className="h-8 w-8"
                onClick={() => {
                  setRemoving(checklist);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <ProgressBar percent={percent} label={`Progresso de ${checklist.name}`} />

            <ul className="flex flex-col">
              {flat.map((entry) => {
                const item = entry.item;
                const group = flat
                  .filter((other) => other.parentItemId === entry.parentItemId)
                  .map((other) => other.item.id);
                const position = group.indexOf(item.id);
                const assignee = members.find(
                  (member) => member.userId.id === item.assigneeId,
                )?.userId;

                return (
                  <li
                    key={item.id}
                    className={cn(
                      'flex flex-wrap items-center gap-2 py-1.5',
                      entry.depth === 1 && 'pl-6',
                    )}
                  >
                    <Checkbox
                      checked={item.done}
                      aria-label={item.text}
                      className="shrink-0"
                      onCheckedChange={(checked) => {
                        patchItem.mutate({
                          checklistId: checklist.id,
                          itemId: item.id,
                          body: { done: checked === true },
                        });
                      }}
                    />

                    <span
                      className={cn(
                        'min-w-0 flex-1 break-words text-[13px]',
                        item.done ? 'text-muted line-through' : 'text-body',
                      )}
                    >
                      {item.text}
                    </span>

                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Responsável de ${item.text}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2"
                        >
                          {assignee ? (
                            <Avatar
                              name={assignee.name}
                              src={assignee.avatarUrl}
                              className="h-6 w-6"
                            />
                          ) : (
                            <User className="h-4 w-4 text-muted" aria-hidden="true" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="max-h-64 w-56 overflow-y-auto">
                        <div className="flex flex-col gap-0.5">
                          {members.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink"
                              onClick={() => {
                                patchItem.mutate({
                                  checklistId: checklist.id,
                                  itemId: item.id,
                                  body: { assigneeId: member.userId.id },
                                });
                              }}
                            >
                              <Avatar
                                name={member.userId.name}
                                src={member.userId.avatarUrl}
                                className="h-6 w-6"
                              />
                              <span className="truncate">{member.userId.name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {entry.depth === 0 ? (
                      <Button
                        variant="nav"
                        size="icon"
                        aria-label={`Adicionar subitem em ${item.text}`}
                        className="h-8 w-8"
                        onClick={() => {
                          const text = window.prompt(`Subitem de "${item.text}"`);

                          if (text !== null && text.trim() !== '') {
                            addItem.mutate({
                              checklistId: checklist.id,
                              text: text.trim(),
                              parentItemId: item.id,
                            });
                          }
                        }}
                      >
                        <CornerDownRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : null}

                    <Button
                      variant="nav"
                      size="icon"
                      aria-label={`Mover ${item.text} para cima`}
                      disabled={position === 0 || reorderItem.isPending}
                      className="h-8 w-8"
                      onClick={() => {
                        reorderItem.mutate({ checklist, itemId: item.id, direction: -1 });
                      }}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="nav"
                      size="icon"
                      aria-label={`Mover ${item.text} para baixo`}
                      disabled={position === group.length - 1 || reorderItem.isPending}
                      className="h-8 w-8"
                      onClick={() => {
                        reorderItem.mutate({ checklist, itemId: item.id, direction: 1 });
                      }}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="nav"
                      size="icon"
                      aria-label={`Excluir ${item.text}`}
                      className="h-8 w-8"
                      onClick={() => {
                        removeItem.mutate({ checklistId: checklist.id, itemId: item.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();

                const text = (drafts[checklist.id] ?? '').trim();

                if (text !== '') {
                  addItem.mutate({ checklistId: checklist.id, text });
                }
              }}
            >
              <Input
                aria-label={`Novo item em ${checklist.name}`}
                placeholder="Novo item"
                value={drafts[checklist.id] ?? ''}
                className="h-10"
                onChange={(event) => {
                  setDrafts((current) => ({ ...current, [checklist.id]: event.target.value }));
                }}
              />
              <Button
                type="submit"
                size="icon"
                aria-label={`Adicionar item em ${checklist.name}`}
                disabled={(drafts[checklist.id] ?? '').trim() === '' || addItem.isPending}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </article>
        );
      })}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          const name = newList.trim();

          if (name !== '') {
            create.mutate(name);
          }
        }}
      >
        <Input
          aria-label="Nova checklist"
          placeholder="Nova checklist"
          value={newList}
          className="h-10"
          onChange={(event) => {
            setNewList(event.target.value);
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Criar checklist"
          disabled={newList.trim() === '' || create.isPending}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        title="Excluir a checklist?"
        description={`"${removing?.name ?? ''}" e todos os itens dela saem da tarefa.`}
        confirmLabel="Excluir"
        danger
        pending={remove.isPending}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id);
          }
        }}
      />
    </section>
  );
}
