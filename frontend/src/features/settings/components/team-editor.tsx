import { useState } from 'react';
import type { Team, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export interface TeamValues {
  name: string;
  memberIds: string[];
}

export interface TeamEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente ao criar. */
  team?: Team;
  members: WorkspaceMemberItem[];
  pending: boolean;
  onSubmit: (values: TeamValues) => void;
}

/** Diálogo de criar e editar equipe: nome e quem participa. */
export function TeamEditor({
  open,
  onOpenChange,
  team,
  members,
  pending,
  onSubmit,
}: TeamEditorProps) {
  const [name, setName] = useState(team?.name ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggle = (userId: string, on: boolean): void => {
    setMemberIds((current) =>
      on ? [...current, userId] : current.filter((item) => item !== userId),
    );
  };

  const submit = (): void => {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      setError('Informe o nome da equipe.');

      return;
    }

    setError(null);
    onSubmit({ name: trimmed, memberIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Editar equipe' : 'Nova equipe'}</DialogTitle>
          <DialogDescription>
            A equipe agrupa pessoas para permissões e filtros das tarefas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-name">Nome da equipe</Label>
          <Input
            id="team-name"
            autoFocus
            value={name}
            placeholder="Squad Produto"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          {error ? (
            <p role="alert" className="text-[12px] text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-[13px] font-medium text-body">Membros</legend>
          <div className="max-h-56 overflow-y-auto">
            {members.map((member) => {
              const userId = member.userId.id;
              const id = `team-member-${userId}`;

              return (
                <label
                  key={userId}
                  htmlFor={id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 text-[13px] text-body hover:bg-surface-2"
                >
                  <Checkbox
                    id={id}
                    checked={memberIds.includes(userId)}
                    onCheckedChange={(checked) => {
                      toggle(userId, checked === true);
                    }}
                  />
                  <span className="min-w-0 truncate">
                    {member.userId.name || member.userId.email}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? <Spinner label="Salvando" /> : 'Salvar equipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
