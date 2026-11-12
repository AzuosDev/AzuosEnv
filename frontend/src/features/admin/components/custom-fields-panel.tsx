import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListTree } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CustomField, CustomFieldScope } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import {
  LocationSelect,
  type LocationValue,
} from '@/features/hierarchy/components/location-select';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { SettingsCard } from '@/features/settings/components/settings-card';
import { treeQuery } from '@/features/shell/api';
import { FIELD_TYPE_LABEL } from '@/features/tasks/field-values';
import { customFieldsQuery, deleteCustomField } from '@/features/tasks/fields-api';

const SCOPE_LABEL: Record<CustomFieldScope, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
};

/**
 * Gestão central dos campos: escolhe o local e mostra os campos que valem lá,
 * dizendo em qual nível cada um foi criado.
 */
export function CustomFieldsPanel({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const selectId = useId();
  const tree = useQuery(treeQuery(wsId));
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [removing, setRemoving] = useState<CustomField | null>(null);

  const firstSpace = tree.data?.spaces[0];
  const current: LocationValue | null =
    location ?? (firstSpace ? { location: 'space', locationId: firstSpace.id } : null);
  const scope = (current?.location ?? 'space') as CustomFieldScope;

  const fields = useQuery({
    ...customFieldsQuery(wsId, scope, current?.locationId ?? ''),
    enabled: Boolean(current?.locationId),
  });

  const remove = useMutation({
    mutationFn: (fieldId: string) => deleteCustomField(wsId, fieldId),
    onSuccess: async () => {
      setRemoving(null);
      await queryClient.invalidateQueries({
        queryKey: ['workspaces', wsId, 'custom-fields'],
      });
      toast.success('Campo excluído com os valores das tarefas.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const nameOfScope = (field: CustomField): string => {
    const spaces = tree.data?.spaces ?? [];

    for (const space of spaces) {
      if (space.id === field.scopeId) {
        return space.name;
      }

      for (const list of space.lists) {
        if (list.id === field.scopeId) {
          return list.name;
        }
      }

      const walk = (folders: typeof space.folders): string | null => {
        for (const folder of folders) {
          if (folder.id === field.scopeId) {
            return folder.name;
          }

          for (const list of folder.lists) {
            if (list.id === field.scopeId) {
              return list.name;
            }
          }

          const deeper = walk(folder.folders);

          if (deeper) {
            return deeper;
          }
        }

        return null;
      };

      const found = walk(space.folders);

      if (found) {
        return found;
      }
    }

    return 'Local sem acesso';
  };

  return (
    <>
      <SettingsCard
        title="Onde olhar"
        description="Os campos de um local são os dele mais os herdados de cima."
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={selectId}>Local</Label>
          {current ? (
            <LocationSelect
              id={selectId}
              wsId={wsId}
              value={current}
              allow={['space', 'folder', 'list']}
              onChange={setLocation}
            />
          ) : (
            <p className="text-[13px] text-muted">Crie um Space para ter campos personalizados.</p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Campos que valem aqui"
        description="Criar campo novo continua na List, pelo painel da tarefa."
      >
        {fields.data && fields.data.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {fields.data.map((field) => (
              <li key={field.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{field.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {FIELD_TYPE_LABEL[field.type]}
                    {field.required ? ' · obrigatório' : ''} · definido em{' '}
                    {SCOPE_LABEL[field.scope]} {nameOfScope(field)}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusPill tone={field.scopeId === current?.locationId ? 'accent' : 'neutral'}>
                    {field.scopeId === current?.locationId ? 'Deste local' : 'Herdado'}
                  </StatusPill>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Excluir ${field.name}`}
                    onClick={() => {
                      setRemoving(field);
                    }}
                  >
                    Excluir
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhum campo neste local"
            description="Campos personalizados nascem na List, pelo painel da tarefa."
            icon={<ListTree className="h-7 w-7" aria-hidden="true" />}
          />
        )}
      </SettingsCard>

      <ConfirmDialog
        open={removing !== null}
        title="Excluir campo personalizado"
        description={`"${removing?.name ?? ''}" sai de todas as tarefas, com os valores já preenchidos.`}
        confirmLabel="Excluir"
        danger
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id);
          }
        }}
      />
    </>
  );
}
