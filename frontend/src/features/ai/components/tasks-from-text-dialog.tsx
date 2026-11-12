import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { ProposedTask } from '@/api/types';
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
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ListPicker } from '@/features/tasks/components/list-picker';
import { confirmTasksFromText, tasksFromText } from '../api';

export interface TasksFromTextDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto já colado pelo chamador (trecho do Doc, mensagem do chat). */
  initialText?: string;
}

/**
 * Criar tarefas a partir de texto: a IA propõe, a lista fica editável e só o
 * confirmar cria as tarefas na List escolhida.
 */
export function TasksFromTextDialog({
  wsId,
  open,
  onOpenChange,
  initialText = '',
}: TasksFromTextDialogProps) {
  const client = useQueryClient();
  const [text, setText] = useState(initialText);
  const [listId, setListId] = useState('');
  const [proposal, setProposal] = useState<ProposedTask[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const propose = useMutation({
    mutationFn: () => tasksFromText(wsId, { text: text.trim(), listId }),
    onSuccess: (result) => {
      setProposal(result.tasks);
      setWarnings(result.warnings);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const confirm = useMutation({
    mutationFn: (tasks: ProposedTask[]) => confirmTasksFromText(wsId, { listId, tasks }),
    onSuccess: async (result) => {
      toast.success(`${String(result.created.length)} tarefa(s) criada(s).`);
      setProposal(null);
      setText('');
      onOpenChange(false);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const rename = (index: number, name: string): void => {
    setProposal((previous) =>
      (previous ?? []).map((task, at) => (at === index ? { ...task, name } : task)),
    );
  };

  const drop = (index: number): void => {
    setProposal((previous) => (previous ?? []).filter((_, at) => at !== index));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);

        if (!next) {
          setProposal(null);
          setWarnings([]);
        }
      }}
    >
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar tarefas a partir de texto</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="tft-list">List de destino</Label>
            <ListPicker id="tft-list" wsId={wsId} value={listId} onChange={setListId} />
          </div>

          <div>
            <Label htmlFor="tft-text">Texto</Label>
            <Textarea
              id="tft-text"
              rows={5}
              value={text}
              placeholder="Cole aqui a ata, o e-mail ou a lista de pendências…"
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </div>

          {propose.isPending ? <Spinner label="A IA está lendo o texto" /> : null}

          {proposal !== null ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-ink">
                Tarefas propostas ({String(proposal.length)})
              </p>

              <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
                {proposal.map((task, index) => (
                  <li key={`${String(index)}-${task.name}`} className="flex items-center gap-2">
                    <Input
                      aria-label={`Tarefa ${String(index + 1)}`}
                      value={task.name}
                      onChange={(event) => {
                        rename(index, event.target.value);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${task.name}`}
                      onClick={() => {
                        drop(index);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>

              {warnings.length > 0 ? (
                <ul className="text-[12px] text-warning">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
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

          {proposal === null ? (
            <Button
              disabled={text.trim() === '' || listId === '' || propose.isPending}
              onClick={() => {
                propose.mutate();
              }}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Propor tarefas
            </Button>
          ) : (
            <Button
              disabled={proposal.length === 0 || confirm.isPending}
              onClick={() => {
                confirm.mutate(proposal);
              }}
            >
              Criar {String(proposal.length)} tarefa(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
