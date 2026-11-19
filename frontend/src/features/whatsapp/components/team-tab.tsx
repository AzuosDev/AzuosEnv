import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaAccessLevel } from '@/api/types';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { membersQuery } from '@/features/settings/api';
import { grantWaAccess, revokeWaAccess, waAccessQuery } from '../api';
import { WA_LEVELS, WA_LEVEL_LABEL, initialsOf } from '../whatsapp-model';

export interface TeamTabProps {
  wsId: string;
}

/** Aba Equipe (gestor): quem entra no atendimento e com qual nível. */
export function TeamTab({ wsId }: TeamTabProps) {
  const queryClient = useQueryClient();
  const access = useQuery(waAccessQuery(wsId));
  const members = useQuery(membersQuery(wsId));
  const [pending, setPending] = useState<string | null>(null);

  const change = (userId: string, level: string): void => {
    setPending(userId);

    const action =
      level === ''
        ? revokeWaAccess(wsId, userId)
        : grantWaAccess(wsId, userId, level as WaAccessLevel);

    void action
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'whatsapp'] });
        toast.success(level === '' ? 'Acesso removido.' : 'Nível atualizado.');
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setPending(null);
      });
  };

  if (access.isPending) {
    return (
      <div className="p-4">
        <Spinner label="Carregando a equipe" />
      </div>
    );
  }

  const nameOf = (userId: string): string => {
    const member = (members.data ?? []).find((item) => item.userId.id === userId);

    return member ? member.userId.name || member.userId.email : userId;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <p className="text-[13px] text-wa-muted">
        Quem não tem nível não enxerga o módulo. Dono e administrador são gestores pelo cargo.
      </p>

      <ul className="flex flex-col overflow-hidden rounded-2xl border border-wa-line bg-wa-panel">
        {(access.data ?? []).map((entry) => {
          const name = nameOf(entry.userId);

          return (
            <li
              key={entry.userId}
              className="flex min-h-11 flex-wrap items-center gap-3 border-b border-wa-line px-3 py-2.5 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent text-[13px] font-semibold text-wa-panel"
              >
                {initialsOf(name)}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold text-wa-text">{name}</span>
                <span className="truncate text-[13px] text-wa-muted">
                  {entry.fromRole
                    ? `Gestor pelo cargo (${entry.role})`
                    : entry.level
                      ? WA_LEVEL_LABEL[entry.level]
                      : 'Sem acesso'}
                </span>
              </span>

              <label className="w-full shrink-0 sm:w-48">
                <span className="sr-only">Nível de {name}</span>
                <SelectNative
                  value={entry.level ?? ''}
                  disabled={entry.fromRole || pending === entry.userId}
                  onChange={(event) => {
                    change(entry.userId, event.target.value);
                  }}
                  className="border-wa-line bg-wa-header text-wa-text"
                >
                  <option value="">Sem acesso</option>
                  {WA_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {WA_LEVEL_LABEL[level]}
                    </option>
                  ))}
                </SelectNative>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
