import { useEffect, useState } from 'react';
import type { CreateTargetInput, TargetType } from '@/api/types';
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
import { ListPicker } from '@/features/tasks/components/list-picker';
import { TARGET_TYPES, TARGET_TYPE_LABEL } from '../goal-model';

export interface TargetDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateTargetInput) => void;
}

interface Draft {
  name: string;
  type: TargetType;
  start: string;
  target: string;
  unit: string;
  listId: string;
}

const EMPTY: Draft = { name: '', type: 'number', start: '0', target: '100', unit: '', listId: '' };

/** Alvo novo: tipo, começo, alvo e, no tipo tarefas, a List acompanhada. */
export function TargetDialog({ wsId, open, onOpenChange, onCreate }: TargetDialogProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);

  useEffect(() => {
    if (open) {
      setDraft(EMPTY);
    }
  }, [open]);

  const isTasks = draft.type === 'tasks';
  const isBoolean = draft.type === 'boolean';
  const invalid =
    draft.name.trim() === '' ||
    (isTasks && draft.listId === '') ||
    (!isTasks && !isBoolean && !Number.isFinite(Number(draft.target.replace(',', '.'))));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo alvo</DialogTitle>
          <DialogDescription>
            O progresso da meta é a média dos alvos. O alvo de tarefas se atualiza sozinho quando as
            tarefas são concluídas.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(submit) => {
            submit.preventDefault();

            if (invalid) {
              return;
            }

            const number = (value: string): number => Number(value.replace(',', '.'));

            onCreate({
              name: draft.name.trim(),
              type: draft.type,
              ...(isTasks
                ? { listId: draft.listId }
                : isBoolean
                  ? { start: 0, target: 1, current: 0 }
                  : {
                      start: number(draft.start),
                      target: number(draft.target),
                      current: number(draft.start),
                      ...(draft.unit.trim() === '' ? {} : { unit: draft.unit.trim() }),
                    }),
            });
            onOpenChange(false);
          }}
        >
          <div>
            <Label htmlFor="target-name">Nome</Label>
            <Input
              id="target-name"
              autoFocus
              value={draft.name}
              placeholder="Tarefas da sprint entregues"
              onChange={(change) => {
                setDraft((current) => ({ ...current, name: change.target.value }));
              }}
            />
          </div>

          <div>
            <Label htmlFor="target-type">Tipo</Label>
            <SelectNative
              id="target-type"
              value={draft.type}
              onChange={(change) => {
                setDraft((current) => ({ ...current, type: change.target.value as TargetType }));
              }}
            >
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TARGET_TYPE_LABEL[type]}
                </option>
              ))}
            </SelectNative>
          </div>

          {isTasks ? (
            <div>
              <Label htmlFor="target-list">List acompanhada</Label>
              <ListPicker
                wsId={wsId}
                id="target-list"
                value={draft.listId}
                onChange={(listId) => {
                  setDraft((current) => ({ ...current, listId }));
                }}
              />
            </div>
          ) : null}

          {!isTasks && !isBoolean ? (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="target-start">Começo</Label>
                  <Input
                    id="target-start"
                    inputMode="decimal"
                    value={draft.start}
                    onChange={(change) => {
                      setDraft((current) => ({ ...current, start: change.target.value }));
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="target-target">Alvo</Label>
                  <Input
                    id="target-target"
                    inputMode="decimal"
                    value={draft.target}
                    onChange={(change) => {
                      setDraft((current) => ({ ...current, target: change.target.value }));
                    }}
                  />
                </div>
              </div>

              {draft.type === 'number' ? (
                <div>
                  <Label htmlFor="target-unit">Unidade</Label>
                  <Input
                    id="target-unit"
                    value={draft.unit}
                    placeholder="horas"
                    onChange={(change) => {
                      setDraft((current) => ({ ...current, unit: change.target.value }));
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : null}

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
            <Button type="submit" disabled={invalid}>
              Criar alvo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
