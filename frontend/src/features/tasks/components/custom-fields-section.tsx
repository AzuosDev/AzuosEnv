import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { queryKeys } from '@/api/keys';
import type { CustomField, TaskDetail, TaskFieldValue, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { taskQuery } from '../api';
import { attachmentsQuery } from '../collaboration-api';
import { asStringArray, fieldValueOf, isReadOnlyField } from '../field-values';
import { CustomFieldInput, type RelatedTask } from './custom-field-input';
import { NewFieldDialog } from './new-field-dialog';

export interface CustomFieldsSectionProps {
  wsId: string;
  listId: string;
  task: TaskDetail;
  members: WorkspaceMemberItem[];
  /** Falso quando o papel não permite editar a tarefa. */
  canWrite: boolean;
  /** Quem pode criar campo na List: admin e membro. */
  canCreateField: boolean;
  onPatch: (customFields: { fieldId: string; value: unknown }[]) => void;
}

/** Ids de tarefa citados pelos campos de relacionamento da tarefa. */
function relatedIds(fields: CustomField[], values: TaskFieldValue[]): string[] {
  const ids = fields
    .filter((field) => field.type === 'relationship')
    .flatMap((field) => asStringArray(fieldValueOf(values, field.id)));

  return [...new Set(ids)];
}

/**
 * Campos personalizados válidos na List da tarefa: render e edição por tipo,
 * fórmula só leitura e "+ Campo" para criar um campo sem sair do painel.
 */
export function CustomFieldsSection({
  wsId,
  listId,
  task,
  members,
  canWrite,
  canCreateField,
  onPatch,
}: CustomFieldsSectionProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const fields = task.fields;
  const values = task.customFields;
  const attachments = useQuery({
    ...attachmentsQuery(wsId, task.customId),
    enabled: fields.some((field) => field.type === 'files'),
  });
  const ids = relatedIds(fields, values);
  const related = useQueries({
    queries: ids.map((id) => ({ ...taskQuery(wsId, id), staleTime: 30_000 })),
  });
  const relatedTasks: RelatedTask[] = related
    .map((result) => result.data)
    .filter((item): item is TaskDetail => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, customId: item.customId }));

  return (
    <section aria-labelledby="task-fields-heading" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden="true" />
        <h2 id="task-fields-heading" className="text-[12.5px] font-semibold text-muted">
          Campos personalizados
        </h2>

        {canCreateField ? (
          <Button
            variant="nav"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Campo
          </Button>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <p className="text-[13px] text-muted">
          Esta List ainda não tem campo personalizado.
          {canCreateField ? ' Crie o primeiro em "+ Campo".' : ''}
        </p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          {fields.map((field) => (
            <div
              key={field.id}
              className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[120px_minmax(0,1fr)]"
            >
              <dt className="min-w-0 truncate text-[12.5px] text-muted" title={field.name}>
                {field.name}
                {field.required ? <span className="text-warning"> *</span> : null}
              </dt>
              <dd className="min-w-0">
                <CustomFieldInput
                  wsId={wsId}
                  field={field}
                  value={fieldValueOf(values, field.id)}
                  members={members}
                  attachments={attachments.data ?? []}
                  related={relatedTasks}
                  disabled={!canWrite || isReadOnlyField(field.type)}
                  onChange={(value) => {
                    onPatch([{ fieldId: field.id, value }]);
                  }}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {canCreateField ? (
        <NewFieldDialog
          wsId={wsId}
          listId={listId}
          open={creating}
          onOpenChange={setCreating}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.task(wsId, task.customId) });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.customFields(wsId, 'list', listId),
            });
          }}
        />
      ) : null}
    </section>
  );
}
