import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
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
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { toast } from '@/components/ui/toast';
import { createSprintFolder } from '../api';

export interface SprintFolderDialogProps {
  wsId: string;
  spaceId: string;
  spaceName: string;
  onClose: () => void;
}

/** Durações oferecidas; a API aceita de 1 a 60 dias. */
const DURATIONS = [7, 14, 21, 28];

/**
 * Pasta de sprints de um Space: ela vira um Folder da hierarquia e cada sprint
 * nasce como uma List com data de início e de fim.
 */
export function SprintFolderDialog({ wsId, spaceId, spaceName, onClose }: SprintFolderDialogProps) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(`Sprints ${spaceName}`);
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [durationDays, setDurationDays] = useState(14);

  const create = useMutation({
    mutationFn: () =>
      createSprintFolder(wsId, {
        spaceId,
        name: name.trim(),
        startDate: new Date(`${startDate}T12:00:00`).toISOString(),
        durationDays,
      }),
    onSuccess: async (view) => {
      await client.invalidateQueries({ queryKey: ['workspaces', wsId] });
      toast.success(`${view.sprintFolder.name} criada com a primeira sprint.`);
      onClose();

      const first = view.sprints[0];

      if (first) {
        await navigate({ to: '/w/$wsId/l/$listId', params: { wsId, listId: first.id } });
      }
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta de sprints</DialogTitle>
          <DialogDescription>
            A pasta vira um Folder do Space e cada sprint é uma List com início e fim. Ao fechar uma
            sprint, o que ficou em aberto vai para a seguinte.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(submit) => {
            submit.preventDefault();

            if (name.trim() === '') {
              return;
            }

            create.mutate();
          }}
        >
          <div>
            <Label htmlFor="sprint-folder-name">Nome</Label>
            <Input
              id="sprint-folder-name"
              autoFocus
              value={name}
              onChange={(change) => {
                setName(change.target.value);
              }}
            />
          </div>

          <div>
            <Label htmlFor="sprint-start">Começo da primeira sprint</Label>
            <Input
              id="sprint-start"
              type="date"
              value={startDate}
              onChange={(change) => {
                setStartDate(change.target.value);
              }}
            />
          </div>

          <div>
            <Label htmlFor="sprint-duration">Duração de cada sprint</Label>
            <SelectNative
              id="sprint-duration"
              value={String(durationDays)}
              onChange={(change) => {
                setDurationDays(Number(change.target.value));
              }}
            >
              {DURATIONS.map((days) => (
                <option key={days} value={days}>
                  {days} dias
                </option>
              ))}
            </SelectNative>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || name.trim() === ''}>
              Criar pasta de sprints
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
