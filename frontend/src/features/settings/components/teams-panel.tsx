import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Team, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import { canAdmin } from '../roles';
import { createTeam, deleteTeam, membersQuery, teamsQuery, updateTeam } from '../api';
import { ConfirmDialog } from './confirm-dialog';
import { SettingsCard, SettingsRow } from './settings-card';
import { TeamEditor, type TeamValues } from './team-editor';

/** Equipes do workspace: criar, editar membros e remover. */
export function TeamsPanel({ wsId, role }: { wsId: string; role: WorkspaceRole }) {
  const queryClient = useQueryClient();
  const { data: teams } = useSuspenseQuery(teamsQuery(wsId));
  const { data: members } = useSuspenseQuery(membersQuery(wsId));
  const [editing, setEditing] = useState<{ team?: Team } | null>(null);
  const [removing, setRemoving] = useState<Team | null>(null);
  const admin = canAdmin(role);

  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.teams(wsId) });

  const save = useMutation({
    mutationFn: (values: TeamValues & { teamId?: string }) =>
      values.teamId
        ? updateTeam(wsId, values.teamId, { name: values.name, memberIds: values.memberIds })
        : createTeam(wsId, { name: values.name, memberIds: values.memberIds }),
    onSuccess: async (_result, values) => {
      setEditing(null);
      await refresh();
      toast.success(values.teamId ? 'Equipe atualizada.' : 'Equipe criada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (teamId: string) => deleteTeam(wsId, teamId),
    onSuccess: async () => {
      setRemoving(null);
      await refresh();
      toast.success('Equipe removida.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const nameOf = (userId: string): string => {
    const member = members.find((item) => item.userId.id === userId);

    return member ? member.userId.name || member.userId.email : 'Pessoa removida';
  };

  return (
    <>
      <SettingsCard
        title="Equipes do workspace"
        description="Grupos de pessoas para permissões e filtros."
        actions={
          admin ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing({});
              }}
            >
              Nova equipe
            </Button>
          ) : null
        }
      >
        {teams.length === 0 ? (
          <EmptyState
            title="Nenhuma equipe"
            description={
              admin
                ? 'Crie a primeira equipe para agrupar as pessoas do workspace.'
                : 'O workspace ainda não tem equipes.'
            }
            icon={<Users className="h-7 w-7" aria-hidden="true" />}
          />
        ) : (
          <div className="flex flex-col">
            {teams.map((team, index) => (
              <SettingsRow
                key={team.id}
                last={index === teams.length - 1}
                title={team.name}
                description={
                  team.memberIds.length === 0
                    ? 'Sem membros'
                    : team.memberIds.map((userId) => nameOf(userId)).join(', ')
                }
                control={
                  admin ? (
                    <span className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${team.name}`}
                        onClick={() => {
                          setEditing({ team });
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover ${team.name}`}
                        onClick={() => {
                          setRemoving(team);
                        }}
                      >
                        Remover
                      </Button>
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </SettingsCard>

      {editing ? (
        <TeamEditor
          key={editing.team?.id ?? 'nova'}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
          {...(editing.team ? { team: editing.team } : {})}
          members={members.filter((member) => member.status !== 'deactivated')}
          pending={save.isPending}
          onSubmit={(values) => {
            save.mutate({ ...values, ...(editing.team ? { teamId: editing.team.id } : {}) });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        title="Remover equipe"
        description={removing ? `A equipe ${removing.name} deixa de existir.` : ''}
        confirmLabel="Remover"
        danger
        pending={remove.isPending}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id);
          }
        }}
      />
    </>
  );
}
