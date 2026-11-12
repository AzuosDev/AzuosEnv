import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { TaskLocation, Template, TemplateTargetType } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { LocationSelect } from '@/features/hierarchy/components/location-select';
import { TaskSearchPicker } from '@/features/tasks/components/task-search-picker';
import { applyTemplate, deleteTemplate, templatesQuery } from '../api';
import { TEMPLATE_TARGETS, TEMPLATE_TYPE_LABEL, targetHint } from '../template-fields';

export interface ApplyTemplateDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

/** Aplicar template: nome do que será criado e o local de destino. */
export function ApplyTemplateDialog({
  wsId,
  open,
  onOpenChange,
  template,
}: ApplyTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<{ type: TemplateTargetType; id: string } | null>(null);
  const [taskLabel, setTaskLabel] = useState('');
  const targets = template ? TEMPLATE_TARGETS[template.type] : [];
  const needsTask = targets.includes('task');

  useEffect(() => {
    if (open && template) {
      setName(template.name);
      setTarget(null);
      setTaskLabel('');
    }
  }, [open, template]);

  const apply = useMutation({
    mutationFn: () => {
      if (!template) {
        throw new Error('Sem template.');
      }

      return applyTemplate(wsId, template.id, {
        name: name.trim(),
        ...(target ? { targetType: target.type, targetId: target.id } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tree'] });
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
      toast.success('Template aplicado.');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const ready = name.trim() !== '' && (targets.length === 0 || target !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar template</DialogTitle>
          <DialogDescription>{template ? targetHint(template.type) : ''}</DialogDescription>
        </DialogHeader>

        {apply.isError ? <FormAlert>{errorMessage(apply.error)}</FormAlert> : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apply-name">Nome</Label>
            <Input
              id="apply-name"
              maxLength={500}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          {targets.length > 0 && !needsTask ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apply-target">Destino</Label>
              <LocationSelect
                id="apply-target"
                wsId={wsId}
                allow={targets.filter((item) => item !== 'task') as TaskLocation[]}
                value={{
                  location: (target?.type ?? targets[0] ?? 'space') as TaskLocation,
                  locationId: target?.id,
                }}
                onChange={(value) => {
                  if (value.locationId && value.location !== 'everything') {
                    setTarget({ type: value.location as TemplateTargetType, id: value.locationId });
                  }
                }}
              />
            </div>
          ) : null}

          {needsTask ? (
            <div className="flex flex-col items-start gap-1.5">
              <Label>Tarefa de destino</Label>
              <TaskSearchPicker
                wsId={wsId}
                label="Buscar tarefa de destino"
                onPick={(task) => {
                  setTarget({ type: 'task', id: task.id });
                  setTaskLabel(`${task.customId} ${task.name}`);
                }}
              >
                <Button variant="ghost" size="sm">
                  {taskLabel || 'Escolher tarefa'}
                </Button>
              </TaskSearchPicker>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={!ready || apply.isPending}
            onClick={() => {
              apply.mutate();
            }}
          >
            {apply.isPending ? <Spinner label="Aplicando" /> : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Galeria: todo template do workspace, com aplicar e excluir. */
export function TemplateGallery({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const list = useQuery(templatesQuery(wsId));
  const [applying, setApplying] = useState<Template | null>(null);

  const remove = useMutation({
    mutationFn: (templateId: string) => deleteTemplate(wsId, templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'templates'] });
      toast.success('Template excluído.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  if (list.isPending) {
    return <Skeleton className="h-40" />;
  }

  if (list.isError) {
    return <FormAlert>{errorMessage(list.error)}</FormAlert>;
  }

  if (list.data.length === 0) {
    return (
      <EmptyState
        title="Nenhum template ainda"
        description='Use "Salvar como template" no menu de um Space, Folder, List ou tarefa para guardar a estrutura.'
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ul className="flex min-w-0 max-w-[880px] flex-col rounded-2xl border border-line bg-surface">
        {list.data.map((template) => (
          <li
            key={template.id}
            className="flex min-w-0 flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0"
          >
            <div className="flex min-w-0 flex-1 basis-[220px] flex-col">
              <span className="truncate text-[14px] font-medium text-ink">{template.name}</span>
              <span className="text-[12px] text-muted">{targetHint(template.type)}</span>
            </div>

            <StatusPill tone="neutral">{TEMPLATE_TYPE_LABEL[template.type]}</StatusPill>

            <Button
              size="sm"
              onClick={() => {
                setApplying(template);
              }}
            >
              Aplicar
            </Button>
            <Button
              variant="nav"
              size="icon"
              aria-label={`Excluir template ${template.name}`}
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(template.id);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      <ApplyTemplateDialog
        wsId={wsId}
        open={applying !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApplying(null);
          }
        }}
        template={applying}
      />
    </div>
  );
}
