import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { CreateGoalInput, GoalFolder, GoalView, UpdateGoalInput } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { membersQuery } from '@/features/settings/api';
import { AssigneesPicker } from '@/features/tasks/components/task-pickers';
import { dueFromInput, dueInputValue } from '../goal-model';

export interface GoalDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: GoalFolder[];
  /** Meta em edição; ausente cria uma nova. */
  view: GoalView | null;
  /** Pasta sugerida na criação. */
  folderId?: string;
  onCreate: (body: CreateGoalInput) => void;
  onUpdate: (goalId: string, body: UpdateGoalInput) => void;
}

interface Draft {
  name: string;
  description: string;
  folderId: string;
  ownerIds: string[];
  dueDate: string;
  private: boolean;
}

function draftOf(view: GoalView | null, folderId?: string): Draft {
  if (!view) {
    return {
      name: '',
      description: '',
      folderId: folderId ?? '',
      ownerIds: [],
      dueDate: '',
      private: false,
    };
  }

  return {
    name: view.goal.name,
    description: view.goal.description ?? '',
    folderId: view.goal.folderId ?? '',
    ownerIds: view.goal.ownerIds,
    dueDate: dueInputValue(view.goal),
    private: view.goal.private,
  };
}

/** Meta nova ou editada: nome, descrição, pasta, donos, prazo e privacidade. */
export function GoalDialog({
  wsId,
  open,
  onOpenChange,
  folders,
  view,
  folderId,
  onCreate,
  onUpdate,
}: GoalDialogProps) {
  const members = useQuery({ ...membersQuery(wsId), enabled: open });
  const [draft, setDraft] = useState<Draft>(() => draftOf(view, folderId));

  useEffect(() => {
    if (open) {
      setDraft(draftOf(view, folderId));
    }
  }, [folderId, open, view]);

  const owners = (members.data ?? []).filter((member) => draft.ownerIds.includes(member.userId.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{view ? 'Editar meta' : 'Nova meta'}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(submit) => {
            submit.preventDefault();

            const name = draft.name.trim();

            if (name === '') {
              return;
            }

            const body = {
              name,
              description: draft.description.trim() === '' ? null : draft.description.trim(),
              ownerIds: draft.ownerIds,
              dueDate: dueFromInput(draft.dueDate),
              private: draft.private,
              folderId: draft.folderId === '' ? null : draft.folderId,
            };

            if (view) {
              onUpdate(view.goal.id, body);
            } else {
              onCreate(body);
            }

            onOpenChange(false);
          }}
        >
          <div>
            <Label htmlFor="goal-name">Nome</Label>
            <Input
              id="goal-name"
              autoFocus
              value={draft.name}
              placeholder="Entregar o PDV da Cênio"
              onChange={(change) => {
                setDraft((current) => ({ ...current, name: change.target.value }));
              }}
            />
          </div>

          <div>
            <Label htmlFor="goal-description">Descrição</Label>
            <Textarea
              id="goal-description"
              rows={3}
              value={draft.description}
              onChange={(change) => {
                setDraft((current) => ({ ...current, description: change.target.value }));
              }}
            />
          </div>

          <div>
            <Label htmlFor="goal-folder">Pasta</Label>
            <SelectNative
              id="goal-folder"
              value={draft.folderId}
              onChange={(change) => {
                setDraft((current) => ({ ...current, folderId: change.target.value }));
              }}
            >
              <option value="">Sem pasta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </SelectNative>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Donos</Label>
            <AssigneesPicker
              members={members.data ?? []}
              value={draft.ownerIds}
              onChange={(ownerIds) => {
                setDraft((current) => ({ ...current, ownerIds }));
              }}
            >
              <Button variant="ghost" size="sm" className="justify-start">
                {owners.length === 0 ? (
                  'Escolher donos'
                ) : (
                  <span className="flex items-center gap-1">
                    {owners.slice(0, 3).map((member) => (
                      <Avatar
                        key={member.id}
                        name={member.userId.name}
                        src={member.userId.avatarUrl}
                        className="h-6 w-6"
                      />
                    ))}
                    {owners.length > 3 ? `+${String(owners.length - 3)}` : null}
                  </span>
                )}
              </Button>
            </AssigneesPicker>
          </div>

          <div>
            <Label htmlFor="goal-due">Prazo</Label>
            <Input
              id="goal-due"
              type="date"
              value={draft.dueDate}
              onChange={(change) => {
                setDraft((current) => ({ ...current, dueDate: change.target.value }));
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="goal-private" className="text-[13px]">
              Privada (só você e os donos veem)
            </Label>
            <Switch
              id="goal-private"
              checked={draft.private}
              onCheckedChange={(checked) => {
                setDraft((current) => ({ ...current, private: checked }));
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={draft.name.trim() === ''}>
              {view ? 'Salvar' : 'Criar meta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
