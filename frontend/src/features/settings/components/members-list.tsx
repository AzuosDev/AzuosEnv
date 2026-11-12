import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { AssignableRole, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { deactivateMember, membersQuery, transferOwnership, updateMemberRole } from '../api';
import {
  ASSIGNABLE_ROLES,
  isOwner,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUS_TONES,
  ROLE_LABELS,
} from '../roles';
import { ConfirmDialog } from './confirm-dialog';
import { SettingsCard } from './settings-card';

interface Pending {
  kind: 'deactivate' | 'transfer';
  member: WorkspaceMemberItem;
}

function describe(member: WorkspaceMemberItem): string {
  return member.userId.name || member.userId.email;
}

/** Pessoas do workspace: papel, status e as ações de admin. */
export function MembersList({
  wsId,
  role,
  currentUserId,
}: {
  wsId: string;
  role: WorkspaceRole;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const { data: members } = useSuspenseQuery(membersQuery(wsId));
  const [pending, setPending] = useState<Pending | null>(null);

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.members(wsId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace(wsId), exact: true }),
    ]);
  };

  const changeRole = useMutation({
    mutationFn: (input: { memberId: string; role: AssignableRole }) =>
      updateMemberRole(wsId, input.memberId, input.role),
    onSuccess: async () => {
      await refresh();
      toast.success('Papel atualizado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const deactivate = useMutation({
    mutationFn: (memberId: string) => deactivateMember(wsId, memberId),
    onSuccess: async () => {
      setPending(null);
      await refresh();
      toast.success('Acesso desativado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const transfer = useMutation({
    mutationFn: (userId: string) => transferOwnership(wsId, userId),
    onSuccess: async () => {
      setPending(null);
      await refresh();
      toast.success('Posse transferida. Você agora é admin.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const admin = role === 'owner' || role === 'admin';

  return (
    <SettingsCard
      title="Quem participa"
      description={`${String(members.length)} ${members.length === 1 ? 'pessoa' : 'pessoas'} no workspace.`}
    >
      <ul className="flex flex-col">
        {members.map((member, index) => {
          const self = member.userId.id === currentUserId;
          const ownerRow = member.role === 'owner';
          const canChangeRole = admin && !ownerRow && !self;

          return (
            <li
              key={member.id}
              className={`flex flex-wrap items-center gap-3 py-3 ${
                index === members.length - 1 ? '' : 'border-b border-line'
              }`}
            >
              <Avatar
                name={describe(member)}
                {...(member.userId.avatarUrl ? { src: member.userId.avatarUrl } : {})}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink">
                  {describe(member)}
                  {self ? <span className="text-muted"> (você)</span> : null}
                </p>
                <p className="truncate text-[12.5px] text-muted">{member.userId.email}</p>
              </div>

              <StatusPill tone={MEMBER_STATUS_TONES[member.status]}>
                {MEMBER_STATUS_LABELS[member.status]}
              </StatusPill>

              {canChangeRole ? (
                <SelectNative
                  aria-label={`Papel de ${describe(member)}`}
                  className="w-44"
                  value={member.role}
                  disabled={changeRole.isPending}
                  onChange={(event) => {
                    changeRole.mutate({
                      memberId: member.id,
                      role: event.target.value as AssignableRole,
                    });
                  }}
                >
                  {ASSIGNABLE_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABELS[option]}
                    </option>
                  ))}
                </SelectNative>
              ) : (
                <span className="text-[13px] text-body">{ROLE_LABELS[member.role]}</span>
              )}

              {admin && !ownerRow && !self && member.status !== 'deactivated' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPending({ kind: 'deactivate', member });
                  }}
                >
                  Desativar
                </Button>
              ) : null}

              {isOwner(role) && !ownerRow && member.status === 'active' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPending({ kind: 'transfer', member });
                  }}
                >
                  Transferir posse
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending?.kind === 'deactivate'}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        title="Desativar acesso"
        description={
          pending
            ? `${describe(pending.member)} perde o acesso ao workspace, mas o histórico fica.`
            : ''
        }
        confirmLabel="Desativar"
        danger
        pending={deactivate.isPending}
        onConfirm={() => {
          if (pending) {
            deactivate.mutate(pending.member.id);
          }
        }}
      />

      <ConfirmDialog
        open={pending?.kind === 'transfer'}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        title="Transferir posse"
        description={
          pending
            ? `${describe(pending.member)} passa a ser o proprietário do workspace e você fica como admin. Só o novo proprietário pode desfazer.`
            : ''
        }
        confirmLabel="Transferir"
        danger
        pending={transfer.isPending}
        onConfirm={() => {
          if (pending) {
            transfer.mutate(pending.member.userId.id);
          }
        }}
      />
    </SettingsCard>
  );
}
