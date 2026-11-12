import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollText } from 'lucide-react';
import { useId, useState } from 'react';
import type { AuditAction, AuditLog } from '@/api/types';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { membersQuery } from '@/features/settings/api';
import { SettingsCard } from '@/features/settings/components/settings-card';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, auditActionLabel } from '../labels';
import { auditLogsQuery } from '../api';

/** Detalhes relevantes da linha, em uma frase curta. */
function detailsLine(log: AuditLog): string {
  const details = log.details as Record<string, unknown> | null;

  if (!details) {
    return '';
  }

  return Object.entries(details)
    .filter(([, value]) => value !== null && typeof value !== 'object')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

/** Log das ações de administração, com filtro por ação e por pessoa. */
export function AuditPanel({ wsId }: { wsId: string }) {
  const actionId = useId();
  const actorId = useId();
  const [action, setAction] = useState<AuditAction | ''>('');
  const [actor, setActor] = useState('');
  const { data: members } = useSuspenseQuery(membersQuery(wsId));
  const logs = useQuery(
    auditLogsQuery(wsId, {
      ...(action ? { action } : {}),
      ...(actor ? { actorId: actor } : {}),
    }),
  );

  const nameOf = (id: string | null): string => {
    if (!id) {
      return 'Sistema';
    }

    const member = members.find((item) => item.userId.id === id);

    return member ? member.userId.name || member.userId.email : 'Pessoa removida';
  };

  const items = logs.data ?? [];

  return (
    <>
      <SettingsCard title="Filtros" description="O log guarda 90 dias de ações de administração.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={actionId}>Ação</Label>
            <SelectNative
              id={actionId}
              value={action}
              onChange={(event) => {
                setAction(event.target.value as AuditAction | '');
              }}
            >
              <option value="">Todas as ações</option>
              {AUDIT_ACTIONS.map((option) => (
                <option key={option} value={option}>
                  {AUDIT_ACTION_LABEL[option]}
                </option>
              ))}
            </SelectNative>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={actorId}>Quem fez</Label>
            <SelectNative
              id={actorId}
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
              }}
            >
              <option value="">Todo mundo</option>
              {members.map((member) => (
                <option key={member.userId.id} value={member.userId.id}>
                  {member.userId.name || member.userId.email}
                </option>
              ))}
            </SelectNative>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Ações" description="Mais recentes primeiro.">
        {items.length === 0 ? (
          <EmptyState
            title={logs.isPending ? 'Carregando…' : 'Nenhuma ação neste filtro'}
            description="Trocas de papel, convites, integrações, webhooks, importação e exportação aparecem aqui."
            icon={<ScrollText className="h-7 w-7" aria-hidden="true" />}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line" aria-label="Ações de administração">
            {items.map((log) => (
              <li key={log.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">
                    {auditActionLabel(log.action)}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {nameOf(log.actorId)} ·{' '}
                    {format(new Date(log.createdAt), "d 'de' MMM yyyy', às' HH:mm", {
                      locale: ptBR,
                    })}
                    {log.ip ? ` · ${log.ip}` : ''}
                  </p>
                  {detailsLine(log) ? (
                    <p className="mt-0.5 break-words text-[12px] text-muted">{detailsLine(log)}</p>
                  ) : null}
                </div>
                <StatusPill>{AUDIT_ENTITY_LABEL[log.entityType]}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}
