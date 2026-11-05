import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { PermissionLevel, PrincipalType } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { Field, FormAlert } from '@/features/auth/components/field';
import { membersQuery, teamsQuery } from '@/features/settings/api';
import {
  folderQuery,
  permissionsQuery,
  share,
  spaceQuery,
  unshare,
  updateFolder,
  updateSpace,
} from '../api';
import { useTreeRefresh } from '../hooks/use-hierarchy-actions';
import { LEVEL_LABEL, NODE_LABEL, PERMISSION_LEVELS } from '../node-kinds';
import type { FlatNode } from '../tree-dnd';

export interface ShareDialogProps {
  wsId: string;
  node: FlatNode;
  onClose: () => void;
}

/** Compartilhamento do Space, Folder ou List: privacidade, pessoas e equipes. */
export function ShareDialog({ wsId, node, onClose }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const refresh = useTreeRefresh(wsId);
  const permissions = useQuery(permissionsQuery(wsId, node.kind, node.id));
  const members = useQuery(membersQuery(wsId));
  const teams = useQuery(teamsQuery(wsId));
  const space = useQuery({ ...spaceQuery(wsId, node.id), enabled: node.kind === 'space' });
  const folder = useQuery({ ...folderQuery(wsId, node.id), enabled: node.kind === 'folder' });

  const [principal, setPrincipal] = useState('');
  const [level, setLevel] = useState<PermissionLevel>('edit');

  const isPrivate = space.data?.private ?? folder.data?.private ?? false;
  const canBePrivate = node.kind === 'space' || node.kind === 'folder';

  const invalidate = (): void => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.permissions(wsId, node.kind, node.id),
    });
  };

  const setPrivate = useMutation({
    mutationFn: async (next: boolean) => {
      if (node.kind === 'space') {
        await updateSpace(wsId, node.id, { private: next });
      } else {
        await updateFolder(wsId, node.id, { private: next });
      }
    },
    onSuccess: (_data, next) => {
      refresh();
      void queryClient.invalidateQueries({
        queryKey:
          node.kind === 'space' ? queryKeys.space(wsId, node.id) : queryKeys.folder(wsId, node.id),
      });
      toast.success(next ? 'Agora é privado.' : 'Agora todo o workspace vê.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const [principalType, principalId] = principal.split(':') as [PrincipalType, string];

      await share(wsId, {
        resourceType: node.kind,
        resourceId: node.id,
        principalType,
        principalId,
        level,
      });
    },
    onSuccess: () => {
      invalidate();
      setPrincipal('');
      toast.success('Acesso concedido.');
    },
  });

  const remove = useMutation({
    mutationFn: (permissionId: string) => unshare(wsId, permissionId),
    onSuccess: () => {
      invalidate();
      toast.success('Acesso removido.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const nameOf = (principalType: string, id: string): string => {
    if (principalType === 'team') {
      return teams.data?.find((team) => team.id === id)?.name ?? 'Equipe';
    }

    const member = members.data?.find((item) => item.userId.id === id);

    return member ? member.userId.name || member.userId.email : 'Pessoa';
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compartilhar {NODE_LABEL[node.kind]}</DialogTitle>
          <DialogDescription>
            Quem recebe acesso a “{node.name}” vê também o que está dentro dele.
          </DialogDescription>
        </DialogHeader>

        {canBePrivate ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-ink" id="share-private-label">
                Privado
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted">
                Ligado, só quem está na lista abaixo tem acesso.
              </span>
            </span>
            <Switch
              aria-labelledby="share-private-label"
              checked={isPrivate}
              disabled={setPrivate.isPending}
              onCheckedChange={(checked) => {
                setPrivate.mutate(checked);
              }}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <Field id="share-principal" label="Pessoa ou equipe">
                <SelectNative
                  id="share-principal"
                  value={principal}
                  onChange={(event) => {
                    setPrincipal(event.target.value);
                  }}
                >
                  <option value="">Selecione…</option>
                  <optgroup label="Pessoas">
                    {(members.data ?? [])
                      .filter((member) => member.status === 'active')
                      .map((member) => (
                        <option key={member.id} value={`user:${member.userId.id}`}>
                          {member.userId.name || member.userId.email}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Equipes">
                    {(teams.data ?? []).map((team) => (
                      <option key={team.id} value={`team:${team.id}`}>
                        {team.name}
                      </option>
                    ))}
                  </optgroup>
                </SelectNative>
              </Field>
            </div>
            <div className="w-full md:w-40">
              <Field id="share-level" label="Nível">
                <SelectNative
                  id="share-level"
                  value={level}
                  onChange={(event) => {
                    setLevel(event.target.value as PermissionLevel);
                  }}
                >
                  {PERMISSION_LEVELS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectNative>
              </Field>
            </div>
            <Button
              className="w-full md:w-auto"
              disabled={!principal || add.isPending}
              onClick={() => {
                add.mutate();
              }}
            >
              {add.isPending ? <Spinner label="Adicionando" /> : 'Adicionar'}
            </Button>
          </div>

          {add.isError ? <FormAlert>{errorMessage(add.error)}</FormAlert> : null}
        </div>

        <section aria-label="Quem tem acesso" className="flex flex-col">
          <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Quem tem acesso
          </h3>

          {permissions.isPending ? <Skeleton className="h-11" /> : null}

          {permissions.isError ? <FormAlert>{errorMessage(permissions.error)}</FormAlert> : null}

          {permissions.data?.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">
              Ninguém foi adicionado ainda. O acesso segue o papel de cada um no workspace.
            </p>
          ) : null}

          <ul className="flex flex-col">
            {(permissions.data ?? []).map((permission) => (
              <li
                key={permission.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] text-ink">
                    {nameOf(permission.principalType, String(permission.principalId))}
                  </span>
                  <span className="text-[12.5px] text-muted">
                    {permission.principalType === 'team' ? 'Equipe' : 'Pessoa'} ·{' '}
                    {LEVEL_LABEL[permission.level]}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover acesso de ${nameOf(
                    permission.principalType,
                    String(permission.principalId),
                  )}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(permission.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
