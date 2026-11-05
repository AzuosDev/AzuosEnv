import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { StatusGroup } from '@/api/types';
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
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { treeQuery } from '@/features/shell/api';
import { crumbsOf, findLocation, type TreeCrumb } from '@/features/shell/tree-path';
import { colorSwatch } from '@/lib/colors';
import { cn } from '@/lib/utils';
import {
  createStatusSet,
  folderQuery,
  listQuery,
  spaceQuery,
  statusSetQuery,
  updateFolder,
  updateList,
  updateSpace,
  updateStatusSet,
} from '../api';
import { useTreeRefresh } from '../hooks/use-hierarchy-actions';
import { NODE_COLORS, NODE_LABEL, STATUS_GROUP_LABEL, STATUS_GROUP_ORDER } from '../node-kinds';
import {
  addStatus,
  draftFromStatuses,
  moveStatus,
  patchStatus,
  removeStatus,
  toStatusInputs,
  validateDraft,
  type StatusDraft,
} from '../status-draft';
import type { FlatNode } from '../tree-dnd';

export interface StatusesDialogProps {
  wsId: string;
  node: FlatNode;
  onClose: () => void;
}

function nodeQuery(wsId: string, crumb: TreeCrumb) {
  if (crumb.kind === 'space') {
    return spaceQuery(wsId, crumb.id);
  }

  return crumb.kind === 'folder' ? folderQuery(wsId, crumb.id) : listQuery(wsId, crumb.id);
}

function StatusRow({
  status,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  status: StatusDraft;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<Omit<StatusDraft, 'key' | 'id'>>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 md:flex-row md:items-center">
      <span
        className={cn('h-3 w-3 shrink-0 rounded-[4px]', colorSwatch(status.color))}
        aria-hidden="true"
      />
      <Input
        aria-label="Nome do status"
        value={status.name}
        placeholder="Nome do status"
        className="md:flex-1"
        onChange={(event) => {
          onChange({ name: event.target.value });
        }}
      />
      <SelectNative
        aria-label="Cor do status"
        value={status.color}
        className="md:w-32"
        onChange={(event) => {
          onChange({ color: event.target.value });
        }}
      >
        {NODE_COLORS.map((color) => (
          <option key={color.value} value={color.value}>
            {color.label}
          </option>
        ))}
      </SelectNative>
      <SelectNative
        aria-label="Grupo do status"
        value={status.group}
        className="md:w-40"
        onChange={(event) => {
          onChange({ group: event.target.value as StatusGroup });
        }}
      >
        {STATUS_GROUP_ORDER.map((group) => (
          <option key={group} value={group}>
            {STATUS_GROUP_LABEL[group]}
          </option>
        ))}
      </SelectNative>
      <span className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Subir ${status.name || 'status'}`}
          disabled={first}
          onClick={() => {
            onMove(-1);
          }}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Descer ${status.name || 'status'}`}
          disabled={last}
          onClick={() => {
            onMove(1);
          }}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${status.name || 'status'}`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </span>
    </li>
  );
}

/**
 * Editor dos statuses do local: edita o conjunto quando ele é do próprio nó e,
 * quando vem do pai, oferece criar um conjunto só dele.
 */
export function StatusesDialog({ wsId, node, onClose }: StatusesDialogProps) {
  const queryClient = useQueryClient();
  const refresh = useTreeRefresh(wsId);
  const tree = useQuery(treeQuery(wsId));
  const location = tree.data ? findLocation(tree.data, node.kind, node.id) : null;
  const chain = location ? crumbsOf(location) : [];
  const docs = useQueries({
    queries: chain.map((crumb) => nodeQuery(wsId, crumb)),
  });

  // Do nó para o Space: o primeiro com conjunto próprio manda nos statuses.
  const ownerIndex = [...docs]
    .map((doc, index) => ({ index, statusSetId: doc.data?.statusSetId ?? null }))
    .reverse()
    .find((entry) => entry.statusSetId !== null)?.index;
  const owner = ownerIndex === undefined ? null : (chain[ownerIndex] ?? null);
  const statusSetId =
    ownerIndex === undefined ? null : String(docs[ownerIndex]?.data?.statusSetId ?? '');
  const inherited = owner !== null && owner.id !== node.id;

  const statusSet = useQuery({
    ...statusSetQuery(wsId, statusSetId ?? ''),
    enabled: Boolean(statusSetId),
  });

  const [draft, setDraft] = useState<StatusDraft[] | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (statusSet.data) {
      setDraft(draftFromStatuses(statusSet.data.statuses));
      setTouched(false);
    }
  }, [statusSet.data]);

  const error = draft ? validateDraft(draft) : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!draft || !statusSetId) {
        return;
      }

      await updateStatusSet(wsId, statusSetId, { statuses: toStatusInputs(draft) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.statusSet(wsId, statusSetId ?? ''),
      });
      refresh();
      toast.success('Statuses salvos.');
      onClose();
    },
  });

  const detach = useMutation({
    mutationFn: async () => {
      if (!draft) {
        return;
      }

      const created = await createStatusSet(wsId, {
        name: `${node.name} — statuses`,
        statuses: toStatusInputs(draft).map(({ name, color, group }) => ({ name, color, group })),
      });

      if (node.kind === 'space') {
        await updateSpace(wsId, node.id, { statusSetId: created.id });
      } else if (node.kind === 'folder') {
        await updateFolder(wsId, node.id, { statusSetId: created.id });
      } else {
        await updateList(wsId, node.id, { statusSetId: created.id });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.space(wsId, node.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.folder(wsId, node.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.list(wsId, node.id) });
      toast.success(`${NODE_LABEL[node.kind]} com statuses próprios.`);
    },
  });

  const reinherit = useMutation({
    mutationFn: async () => {
      if (node.kind === 'folder') {
        await updateFolder(wsId, node.id, { statusSetId: null });
      } else if (node.kind === 'list') {
        await updateList(wsId, node.id, { statusSetId: null });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folder(wsId, node.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.list(wsId, node.id) });
      refresh();
      toast.success('Voltou a herdar os statuses do pai.');
    },
  });

  const update = (next: StatusDraft[]): void => {
    setDraft(next);
    setTouched(true);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Statuses de “{node.name}”</DialogTitle>
          <DialogDescription>
            {inherited && owner
              ? `Herdando os statuses do ${NODE_LABEL[owner.kind]} “${owner.name}”.`
              : 'Estes statuses valem para este local e para tudo que está dentro dele.'}
          </DialogDescription>
        </DialogHeader>

        {statusSet.isError ? <FormAlert>{errorMessage(statusSet.error)}</FormAlert> : null}
        {save.isError ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}
        {detach.isError ? <FormAlert>{errorMessage(detach.error)}</FormAlert> : null}

        {draft === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : (
          <>
            {inherited ? (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[13px] text-body">
                  Para mudar só aqui, crie um conjunto próprio com uma cópia destes statuses.
                </p>
                <Button
                  variant="outline"
                  disabled={detach.isPending}
                  onClick={() => {
                    detach.mutate();
                  }}
                >
                  {detach.isPending ? <Spinner label="Criando" /> : 'Criar statuses próprios'}
                </Button>
              </div>
            ) : null}

            <ul className={cn('flex flex-col', inherited && 'pointer-events-none opacity-60')}>
              {draft.map((status, index) => (
                <StatusRow
                  key={status.key}
                  status={status}
                  first={index === 0}
                  last={index === draft.length - 1}
                  onChange={(patch) => {
                    update(patchStatus(draft, status.key, patch));
                  }}
                  onMove={(offset) => {
                    update(moveStatus(draft, status.key, offset));
                  }}
                  onRemove={() => {
                    update(removeStatus(draft, status.key));
                  }}
                />
              ))}
            </ul>

            {inherited ? null : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    update(addStatus(draft));
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar status
                </Button>
                {node.kind === 'space' ? null : (
                  <Button
                    variant="ghost"
                    disabled={reinherit.isPending}
                    onClick={() => {
                      reinherit.mutate();
                    }}
                  >
                    {reinherit.isPending ? <Spinner label="Salvando" /> : 'Voltar a herdar do pai'}
                  </Button>
                )}
              </div>
            )}

            {touched && error ? <FormAlert>{error}</FormAlert> : null}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                {inherited ? 'Fechar' : 'Cancelar'}
              </Button>
              {inherited ? null : (
                <Button
                  disabled={save.isPending || error !== null}
                  onClick={() => {
                    save.mutate();
                  }}
                >
                  {save.isPending ? <Spinner label="Salvando" /> : 'Salvar statuses'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
