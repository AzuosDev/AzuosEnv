import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { Checklist, TaskDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { membersQuery, workspaceQuery } from '@/features/settings/api';
import { canAdmin } from '@/features/settings/roles';
import { treeQuery } from '@/features/shell/api';
import { crumbsOf, findLocation } from '@/features/shell/tree-path';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  addTaskToList,
  archiveTask,
  deleteTask,
  listStatusesQuery,
  moveTask,
  tagsQuery,
  taskQuery,
} from '../api';
import { fieldValuesBody, withFieldValue } from '../field-values';
import type { PanelMode } from '../panel-mode';
import { useTaskDetailActions } from '../hooks/use-task-detail';
import { useTaskRealtime } from '../hooks/use-task-realtime';
import { ActivitySection } from './activity-section';
import { AttachmentsSection } from './attachments-section';
import { ChecklistsSection } from './checklists-section';
import { CustomFieldsSection } from './custom-fields-section';
import { DependenciesSection } from './dependencies-section';
import { ListPicker } from './list-picker';
import { SubtasksSection } from './subtasks-section';
import { TaskDescription } from './task-description';
import { TaskPanelFields } from './task-panel-fields';
import { SaveTemplateDialog } from '@/features/templates/components/save-template-dialog';
import { TaskPanelHeader } from './task-panel-header';
import { TimeSection } from './time-section';

/** Espera depois da última tecla antes de gravar o nome. */
export const NAME_DEBOUNCE_MS = 700;

export interface TaskPanelProps {
  wsId: string;
  customId: string;
  /** Null abaixo de 1024 px: lá o painel é sempre tela cheia. */
  mode: PanelMode | null;
  onMode: (mode: PanelMode) => void;
  onClose: () => void;
}

type PendingAction = 'move' | 'addList' | 'archive' | 'delete' | null;

/**
 * Painel da tarefa: cabeçalho, nome, campos, descrição, subtarefas, checklists
 * e tempo. Cada parte grava sozinha; não existe botão de salvar.
 */
export function TaskPanel({ wsId, customId, mode, onMode, onClose }: TaskPanelProps) {
  const user = useSession();
  const detail = useQuery(taskQuery(wsId, customId));
  const task = detail.data;
  const { data: tree } = useQuery(treeQuery(wsId));
  const members = useQuery(membersQuery(wsId));
  const statuses = useQuery({
    ...listStatusesQuery(wsId, task?.listId ?? ''),
    enabled: Boolean(task?.listId),
  });
  const actions = useTaskDetailActions(wsId, customId);
  const workspace = useQuery(workspaceQuery(wsId));
  const tags = useQuery(tagsQuery(wsId));
  const viewers = useTaskRealtime({
    wsId,
    taskId: task?.id,
    customId,
    currentUserId: user?.id,
  });

  const [name, setName] = useState('');
  const [action, setAction] = useState<PendingAction>(null);
  const [targetList, setTargetList] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const nameTimer = useRef<number | undefined>(undefined);

  // O nome do servidor vence enquanto a pessoa não está digitando.
  useEffect(() => {
    if (task && nameTimer.current === undefined) {
      setName(task.name);
    }
  }, [task]);

  useEffect(
    () => () => {
      window.clearTimeout(nameTimer.current);
    },
    [],
  );

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const move = useMutation({
    mutationFn: (listId: string) => moveTask(wsId, customId, { listId }),
    onSuccess: () => {
      setAction(null);
      setTargetList('');
      actions.refresh();
      toast.success('Tarefa movida.');
    },
    onError,
  });

  const addList = useMutation({
    mutationFn: (listId: string) => addTaskToList(wsId, customId, listId),
    onSuccess: () => {
      setAction(null);
      setTargetList('');
      actions.refresh();
      toast.success('Tarefa adicionada à List.');
    },
    onError,
  });

  const archive = useMutation({
    mutationFn: () => archiveTask(wsId, customId),
    onSuccess: () => {
      setAction(null);
      actions.refresh();
      toast.success('Tarefa arquivada.');
      onClose();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: () => deleteTask(wsId, customId),
    onSuccess: () => {
      setAction(null);
      actions.refresh();
      toast.success('Tarefa na lixeira.');
      onClose();
    },
    onError,
  });

  if (detail.isPending) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner label="Carregando a tarefa" />
      </div>
    );
  }

  if (detail.isError || !task) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Button variant="ghost" size="sm" className="self-start" onClick={onClose}>
          Voltar
        </Button>
        <EmptyState
          title="Tarefa não encontrada"
          description="Ela pode estar na lixeira, arquivada ou você não tem acesso."
        />
      </div>
    );
  }

  const location = findLocation(tree, 'list', task.listId);
  const crumbs = location ? crumbsOf(location) : [];
  const spaceId = location?.trail[0]?.id ?? '';
  const people = members.data ?? [];
  const statusList = statuses.data?.statuses ?? [];
  const following = user ? task.watcherIds.includes(user.id) : false;
  const role = workspace.data?.role ?? 'guest';
  // Editar é dos papéis internos; comentar é de todos, inclusive do convidado.
  const canWrite = role !== 'guest';
  const canCreateField = canAdmin(role) || role === 'member';

  // Campo personalizado tem caminho próprio: o corpo dele é parcial por campo.
  const patch = (body: Omit<Partial<TaskDetail>, 'customFields'>): void => {
    void actions.patch(body, body);
  };

  const onName = (value: string): void => {
    setName(value);
    window.clearTimeout(nameTimer.current);

    nameTimer.current = window.setTimeout(() => {
      nameTimer.current = undefined;

      const trimmed = value.trim();

      if (trimmed !== '' && trimmed !== task.name) {
        void actions.patch({ name: trimmed }, { name: trimmed });
      }
    }, NAME_DEBOUNCE_MS);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TaskPanelHeader
        wsId={wsId}
        task={task}
        statuses={statusList}
        crumbs={crumbs}
        members={people}
        viewers={viewers}
        currentUserId={user?.id}
        mode={mode}
        following={following}
        onMode={onMode}
        onStatus={(statusId) => {
          patch({ statusId } as Partial<TaskDetail>);
        }}
        onFollow={() => {
          const watcherIds = following
            ? task.watcherIds.filter((id) => id !== user?.id)
            : [...task.watcherIds, user?.id ?? ''];

          patch({ watcherIds: watcherIds.filter((id) => id !== '') });
        }}
        onMove={() => {
          setTargetList(task.listId);
          setAction('move');
        }}
        onAddList={() => {
          setTargetList('');
          setAction('addList');
        }}
        onArchive={() => {
          setAction('archive');
        }}
        onSaveTemplate={() => {
          setSavingTemplate(true);
        }}
        onDelete={() => {
          setAction('delete');
        }}
        onClose={onClose}
      />

      <div data-panel-scroll className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label htmlFor="task-name" className="sr-only">
              Nome da tarefa
            </label>
            <input
              id="task-name"
              value={name}
              className="heading w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-xl outline-none hover:border-line focus-visible:border-accent md:text-2xl"
              onChange={(event) => {
                onName(event.target.value);
              }}
            />
          </div>

          <TaskPanelFields
            wsId={wsId}
            spaceId={spaceId}
            task={task}
            members={people}
            onPatch={patch}
            onRecurrence={(recurrence) => {
              void actions.patch(
                { recurrence },
                { recurrence: recurrence ? { createNew: true, ...recurrence } : null },
              );
            }}
          />

          <TaskDescription
            wsId={wsId}
            value={task.description}
            onSave={(body) => actions.patch(body)}
          />

          <SubtasksSection
            wsId={wsId}
            parentId={task.id}
            parentCustomId={task.customId}
            listId={task.listId}
            statuses={statusList}
            members={people}
            onChanged={actions.refresh}
          />

          <ChecklistsSection
            wsId={wsId}
            taskId={task.id}
            checklists={task.checklists as Checklist[]}
            members={people}
            onChecklist={actions.setChecklist}
            onRemoved={actions.dropChecklist}
          />

          <TimeSection
            wsId={wsId}
            taskId={task.id}
            trackedMinutes={task.trackedMinutes}
            members={people}
            currentUserId={user?.id ?? null}
            onChanged={actions.refresh}
          />

          <CustomFieldsSection
            wsId={wsId}
            listId={task.listId}
            task={task}
            members={people}
            canWrite={canWrite}
            canCreateField={canCreateField}
            onPatch={(changes) => {
              // O PATCH é parcial, mas o cache precisa da lista inteira.
              const merged = changes.reduce(
                (values, change) => withFieldValue(values, change.fieldId, change.value),
                task.customFields,
              );

              void actions.patch(
                { customFields: fieldValuesBody(changes) },
                { customFields: merged },
              );
            }}
          />

          <DependenciesSection
            wsId={wsId}
            taskId={task.id}
            customId={task.customId}
            canWrite={canWrite}
          />

          <AttachmentsSection
            wsId={wsId}
            customId={task.customId}
            members={people}
            canWrite={canWrite}
            onChanged={actions.refresh}
          />

          <ActivitySection
            wsId={wsId}
            customId={task.customId}
            members={people}
            statuses={statusList}
            tags={tags.data ?? []}
            currentUserId={user?.id}
            role={role}
            canWrite
          />
        </div>
      </div>

      <Dialog
        open={action === 'move' || action === 'addList'}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {action === 'move' ? 'Mover a tarefa' : 'Adicionar a outra List'}
            </DialogTitle>
          </DialogHeader>

          <label htmlFor="task-target-list" className="flex flex-col gap-1.5 text-[13px] text-body">
            List de destino
            <ListPicker
              wsId={wsId}
              id="task-target-list"
              value={targetList}
              onChange={setTargetList}
            />
          </label>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAction(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={targetList === '' || move.isPending || addList.isPending}
              onClick={() => {
                if (action === 'move') {
                  move.mutate(targetList);

                  return;
                }

                addList.mutate(targetList);
              }}
            >
              {action === 'move' ? 'Mover' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={action === 'archive'}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
          }
        }}
        title="Arquivar a tarefa?"
        description="Ela sai das views e fica em Arquivados, com as subtarefas diretas."
        confirmLabel="Arquivar"
        pending={archive.isPending}
        onConfirm={() => {
          archive.mutate();
        }}
      />

      <ConfirmDialog
        open={action === 'delete'}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
          }
        }}
        title="Excluir a tarefa?"
        description="Ela vai para a lixeira por 30 dias, com as subtarefas."
        confirmLabel="Excluir"
        danger
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate();
        }}
      />

      <SaveTemplateDialog
        wsId={wsId}
        open={savingTemplate}
        onOpenChange={setSavingTemplate}
        source={{ type: 'task', id: task.id, name: task.name }}
      />
    </div>
  );
}
