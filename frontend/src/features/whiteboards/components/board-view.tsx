import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ListPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
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
import { toast } from '@/components/ui/toast';
import { ListPicker } from '@/features/tasks/components/list-picker';
import { elementToTask, renameWhiteboard, whiteboardQuery } from '../api';
import type { CanvasElement } from '../elements';
import { useBoardSync } from '../hooks/use-board-sync';
import { BoardCanvas } from './board-canvas';

const SAVE_LABEL: Record<string, string> = {
  idle: '',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Falhou ao salvar',
};

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export interface BoardViewProps {
  wsId: string;
  whiteboardId: string;
}

/** Quadro aberto: canvas, salvamento automático e conversão em tarefa. */
export function BoardView({ wsId, whiteboardId }: BoardViewProps) {
  const client = useQueryClient();
  const board = useQuery(whiteboardQuery(wsId, whiteboardId));
  const sync = useBoardSync(wsId, board.data);
  const { queue } = sync;
  const [selected, setSelected] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [listId, setListId] = useState('');
  const [title, setTitle] = useState<string | null>(null);

  /**
   * O Excalidraw chama onChange a cada render. A seleção só pode virar estado
   * novo quando muda de verdade: um array novo igual ao anterior realimentaria
   * o canvas e o React estouraria o limite de updates.
   */
  const handleChange = useCallback(
    (elements: readonly CanvasElement[], selectedIds: string[]) => {
      setSelected((current) => (sameIds(current, selectedIds) ? current : selectedIds));
      queue(elements);
    },
    [queue],
  );

  const rename = useMutation({
    mutationFn: (next: string) => renameWhiteboard(wsId, whiteboardId, next),
    onSuccess: async (saved) => {
      setTitle(null);
      client.setQueryData(queryKeys.whiteboard(wsId, whiteboardId), saved);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'whiteboards'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const convert = useMutation({
    mutationFn: (elementId: string) => elementToTask(wsId, whiteboardId, elementId, listId),
    onSuccess: async (result) => {
      setConverting(false);
      toast.success(`Tarefa ${result.task.customId} criada.`);
      client.setQueryData(queryKeys.whiteboard(wsId, whiteboardId), result.whiteboard);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  if (board.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Carregando o quadro" />
      </div>
    );
  }

  if (!board.data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted">
        Este quadro não existe ou você não tem acesso a ele.
      </div>
    );
  }

  const one = selected.length === 1 ? selected[0] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2 md:px-6">
        <Button variant="ghost" size="icon" aria-label="Voltar aos quadros" asChild>
          <Link to="/w/$wsId/whiteboards" params={{ wsId }}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <label htmlFor="board-title" className="sr-only">
          Título do quadro
        </label>
        <Input
          id="board-title"
          value={title ?? board.data.title}
          className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-[17px] font-semibold text-ink md:max-w-sm"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onBlur={() => {
            const next = (title ?? '').trim();

            if (next !== '' && next !== board.data.title) {
              rename.mutate(next);

              return;
            }

            setTitle(null);
          }}
        />

        <span role="status" className="text-[12px] text-muted">
          {SAVE_LABEL[sync.state]}
        </span>

        <Button
          size="sm"
          disabled={one === undefined}
          onClick={() => {
            setConverting(true);
          }}
        >
          <ListPlus className="h-4 w-4" aria-hidden="true" /> Converter em tarefa
        </Button>
      </header>

      {sync.scene.epoch > 0 ? (
        <BoardCanvas scene={sync.scene} editable onChange={handleChange} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner label="Carregando o quadro" />
        </div>
      )}

      <Dialog open={converting} onOpenChange={setConverting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter em tarefa</DialogTitle>
          </DialogHeader>

          <div>
            <Label htmlFor="board-to-task-list">List de destino</Label>
            <ListPicker id="board-to-task-list" wsId={wsId} value={listId} onChange={setListId} />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConverting(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={listId === '' || one === undefined || convert.isPending}
              onClick={() => {
                if (one !== undefined) {
                  convert.mutate(one);
                }
              }}
            >
              Criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
