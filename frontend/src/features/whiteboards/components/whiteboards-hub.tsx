import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PenTool, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Whiteboard, WhiteboardLocationType } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { treeQuery } from '@/features/shell/api';
import { whiteboardsQuery } from '../api';
import { NewWhiteboardDialog } from './new-whiteboard-dialog';

interface Place {
  value: string;
  label: string;
  locationType?: WhiteboardLocationType;
  locationId?: string;
}

function BoardCard({ board, onOpen }: { board: Whiteboard; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-left hover:border-scene-line hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          <PenTool className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {board.title}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span>
            Editado{' '}
            {formatDistanceToNow(new Date(board.updatedAt), { addSuffix: true, locale: ptBR })}
          </span>
          <span>{board.elements.length} item(ns)</span>
        </span>
      </button>
    </li>
  );
}

/** Hub de quadros: filtro por local e o quadro novo. */
export function WhiteboardsHub({ wsId }: { wsId: string }) {
  const navigate = useNavigate();
  const tree = useQuery(treeQuery(wsId));
  const [place, setPlace] = useState('all');
  const [creating, setCreating] = useState(false);

  const places: Place[] = [
    { value: 'all', label: 'Todos os locais' },
    { value: 'workspace', label: 'Workspace', locationType: 'workspace' },
  ];

  for (const space of tree.data?.spaces ?? []) {
    places.push({
      value: `space:${space.id}`,
      label: `Space: ${space.name}`,
      locationType: 'space',
      locationId: space.id,
    });
  }

  const picked = places.find((option) => option.value === place) ?? places[0];
  const boards = useQuery(
    whiteboardsQuery(wsId, {
      ...(picked?.locationType === undefined ? {} : { locationType: picked.locationType }),
      ...(picked?.locationId === undefined ? {} : { locationId: picked.locationId }),
    }),
  );
  const items = boards.data ?? [];

  const open = (whiteboardId: string): void => {
    void navigate({
      to: '/w/$wsId/whiteboards/$whiteboardId',
      params: { wsId, whiteboardId },
    });
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="heading min-w-0 flex-1 text-[22px]">Whiteboards</h1>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Novo quadro
        </Button>
      </header>

      <div className="max-w-sm">
        <label htmlFor="board-place" className="sr-only">
          Local dos quadros
        </label>
        <SelectNative
          id="board-place"
          value={place}
          onChange={(event) => {
            setPlace(event.target.value);
          }}
        >
          {places.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectNative>
      </div>

      {boards.isPending ? <Spinner label="Carregando quadros" /> : null}

      {!boards.isPending && items.length === 0 ? (
        <EmptyState
          title="Nenhum quadro por aqui"
          description="Crie um quadro para desenhar fluxos, mapear ideias e virar tarefa em um clique."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Novo quadro
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <ul className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {items.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onOpen={() => {
                open(board.id);
              }}
            />
          ))}
        </ul>
      ) : null}

      <NewWhiteboardDialog
        wsId={wsId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(board) => {
          open(board.id);
        }}
      />
    </div>
  );
}
