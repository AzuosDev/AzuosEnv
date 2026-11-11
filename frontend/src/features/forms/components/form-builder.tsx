import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type {
  FormConditionInput,
  FormFieldInput,
  UpdateFormInput,
  WorkspaceForm,
} from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { membersQuery } from '@/features/settings/api';
import { listStatusesQuery } from '@/features/tasks/api';
import { customFieldsQuery } from '@/features/tasks/fields-api';
import { updateForm } from '../api';
import {
  embedCode,
  emptyField,
  moveField,
  recallFormLink,
  removeField,
  toConditionInputs,
  toFieldInputs,
  toPublicConditions,
  toPublicFields,
} from '../form-model';
import { ConditionEditor } from './condition-editor';
import { FieldEditor } from './field-editor';
import { FormFieldsView, type FormValues } from './form-fields-view';

export interface FormBuilderProps {
  wsId: string;
  listId: string;
  form: WorkspaceForm;
  canEdit: boolean;
}

interface Draft {
  title: string;
  description: string;
  fields: FormFieldInput[];
  conditions: FormConditionInput[];
  defaultAssigneeId: string;
  defaultStatusId: string;
  active: boolean;
}

function draftOf(form: WorkspaceForm): Draft {
  return {
    title: form.title,
    description: form.description ?? '',
    fields: toFieldInputs(form),
    conditions: toConditionInputs(form),
    defaultAssigneeId: form.defaultAssigneeId ?? '',
    defaultStatusId: form.defaultStatusId ?? '',
    active: form.active,
  };
}

async function copy(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('O navegador não deixou copiar. Selecione o texto e copie à mão.');
  }
}

/**
 * Construtor do formulário: à esquerda a prévia do que o cliente vê, à direita a
 * configuração. O link público só volta na criação, então o navegador guarda o
 * endereço daquele formulário para poder copiá-lo de novo.
 */
export function FormBuilder({ wsId, listId, form, canEdit }: FormBuilderProps) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(form));
  const [values, setValues] = useState<FormValues>({});
  const members = useQuery(membersQuery(wsId));
  const statuses = useQuery(listStatusesQuery(wsId, listId));
  const customFields = useQuery(customFieldsQuery(wsId, 'list', listId));
  const link = recallFormLink(form.id);

  useEffect(() => {
    setDraft(draftOf(form));
  }, [form]);

  const save = useMutation({
    mutationFn: (body: UpdateFormInput) => updateForm(wsId, form.id, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'forms'] });
      toast.success('Formulário salvo.');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const patch = (next: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...next }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 px-4 pb-10 md:px-6 lg:flex-row lg:items-start">
      <section
        aria-label="Prévia do formulário público"
        className="stage relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-scene-line"
      >
        <div
          className="dot-grid pointer-events-none absolute inset-0 opacity-60"
          aria-hidden="true"
        />

        <div className="relative flex max-w-[620px] flex-col gap-5 p-5 md:p-8">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="btn-signal flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold"
            >
              {'</>'}
            </span>
            <span className="font-semibold text-ink">Azuos Dev</span>
          </span>

          <div className="flex flex-col gap-2">
            <h2 className="heading text-2xl md:text-3xl">{draft.title}</h2>
            {draft.description === '' ? null : (
              <p className="text-[14px] text-body">{draft.description}</p>
            )}
          </div>

          <FormFieldsView
            fields={toPublicFields(draft.fields)}
            conditions={toPublicConditions(draft.conditions)}
            values={values}
            idPrefix="preview"
            onChange={(fieldId, value) => {
              setValues((current) => ({ ...current, [fieldId]: value }));
            }}
          />

          <Button variant="outline" size="lg" disabled>
            Enviar (prévia)
          </Button>
        </div>
      </section>

      <aside
        aria-label="Configuração do formulário"
        className="flex w-full min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface p-4 lg:w-[380px] lg:shrink-0"
      >
        <h2 className="text-base font-semibold text-ink">Configuração</h2>

        <div>
          <Label htmlFor="form-title">Título</Label>
          <Input
            id="form-title"
            value={draft.title}
            disabled={!canEdit}
            onChange={(change) => {
              patch({ title: change.target.value });
            }}
          />
        </div>

        <div>
          <Label htmlFor="form-description">Descrição</Label>
          <Textarea
            id="form-description"
            rows={2}
            value={draft.description}
            disabled={!canEdit}
            onChange={(change) => {
              patch({ description: change.target.value });
            }}
          />
        </div>

        <div>
          <Label htmlFor="form-assignee">Responsável padrão</Label>
          <SelectNative
            id="form-assignee"
            value={draft.defaultAssigneeId}
            disabled={!canEdit}
            onChange={(change) => {
              patch({ defaultAssigneeId: change.target.value });
            }}
          >
            <option value="">Sem responsável</option>
            {(members.data ?? []).map((member) => (
              <option key={member.id} value={member.userId.id}>
                {member.userId.name}
              </option>
            ))}
          </SelectNative>
        </div>

        <div>
          <Label htmlFor="form-status">Status inicial</Label>
          <SelectNative
            id="form-status"
            value={draft.defaultStatusId}
            disabled={!canEdit}
            onChange={(change) => {
              patch({ defaultStatusId: change.target.value });
            }}
          >
            <option value="">Primeiro status da List</option>
            {(statuses.data?.statuses ?? []).map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </SelectNative>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="form-active" className="text-[13px]">
            Formulário ativo
          </Label>
          <Switch
            id="form-active"
            checked={draft.active}
            disabled={!canEdit}
            onCheckedChange={(checked) => {
              patch({ active: checked });
            }}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink">Perguntas</h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canEdit}
              onClick={() => {
                patch({ fields: [...draft.fields, emptyField(draft.fields)] });
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova pergunta
            </Button>
          </div>

          {draft.fields.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              Sem perguntas ainda. Crie a primeira e aponte para onde ela vai na tarefa.
            </p>
          ) : null}

          {draft.fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              total={draft.fields.length}
              customFields={customFields.data ?? []}
              onChange={(next) => {
                patch({
                  fields: draft.fields.map((item) => (item.id === field.id ? next : item)),
                });
              }}
              onMove={(delta) => {
                patch({ fields: moveField(draft.fields, index, delta) });
              }}
              onRemove={() => {
                patch(removeField(draft.fields, draft.conditions, field.id));
              }}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-ink">Condições</h3>
          <ConditionEditor
            fields={draft.fields}
            conditions={draft.conditions}
            onChange={(conditions) => {
              patch({ conditions });
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-ink">Link público</h3>
          {link ? (
            <>
              <span className="truncate rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-body">
                {link}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void copy(link, 'Link copiado.');
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copiar link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void copy(embedCode(link, draft.title), 'Código de incorporação copiado.');
                  }}
                >
                  Copiar código do site
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[12.5px] text-muted">
              O endereço público aparece uma única vez, quando o formulário é criado, e fica
              guardado no navegador que o criou. Crie outro formulário para gerar um link novo.
            </p>
          )}
        </div>

        {canEdit ? (
          <Button
            disabled={save.isPending || draft.title.trim() === ''}
            onClick={() => {
              save.mutate({
                title: draft.title.trim(),
                description: draft.description.trim() === '' ? null : draft.description.trim(),
                fields: draft.fields,
                conditions: draft.conditions,
                defaultAssigneeId: draft.defaultAssigneeId === '' ? null : draft.defaultAssigneeId,
                defaultStatusId: draft.defaultStatusId === '' ? null : draft.defaultStatusId,
                active: draft.active,
              });
            }}
          >
            Salvar formulário
          </Button>
        ) : null}
      </aside>
    </div>
  );
}
