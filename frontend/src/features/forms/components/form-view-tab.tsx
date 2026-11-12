import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { createForm, formsQuery } from '../api';
import { publicFormUrl, rememberFormLink } from '../form-model';
import { FormBuilder } from './form-builder';

export interface FormViewTabProps {
  wsId: string;
  listId: string;
  listName: string;
  role: WorkspaceRole | undefined;
}

/** Papéis internos criam e editam formulário; convidado só olha. */
function canEditForms(role: WorkspaceRole | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

/** Perguntas iniciais do formulário novo, já apontando para a tarefa. */
const STARTER_FIELDS = [
  { id: 'q1', label: 'Nome', type: 'text' as const, required: true, options: [], mapTo: 'name' },
  {
    id: 'q2',
    label: 'E-mail ou WhatsApp',
    type: 'text' as const,
    required: true,
    options: [],
    mapTo: null,
  },
  {
    id: 'q3',
    label: 'Mensagem',
    type: 'longText' as const,
    required: false,
    options: [],
    mapTo: 'description',
  },
];

/** View Formulário da List: o construtor e a prévia do que o cliente vê. */
export function FormViewTab({ wsId, listId, listName, role }: FormViewTabProps) {
  const client = useQueryClient();
  const forms = useQuery(formsQuery(wsId, listId));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const canEdit = canEditForms(role);

  const create = useMutation({
    mutationFn: () =>
      createForm(wsId, {
        listId,
        title: `Formulário de ${listName}`,
        description: 'Conte o que você precisa. Retornamos com os próximos passos.',
        fields: STARTER_FIELDS,
      }),
    onSuccess: async (result) => {
      rememberFormLink(result.form.id, result.token ? publicFormUrl(result.token) : '');
      setPickedId(result.form.id);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'forms'] });
      toast.success('Formulário criado. O link público está na configuração.');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  if (forms.isPending) {
    return (
      <div className="px-4 py-8 md:px-6">
        <Spinner label="Carregando os formulários" />
      </div>
    );
  }

  const items = forms.data ?? [];
  const form = items.find((item) => item.id === pickedId) ?? items[0];

  if (!form) {
    return (
      <div className="px-4 pb-8 md:px-6">
        <EmptyState
          title="Nenhum formulário nesta List"
          description="Um formulário público cria uma tarefa aqui a cada envio, com os campos que você mapear."
          icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
          action={
            canEdit ? (
              <Button
                variant="outline"
                disabled={create.isPending}
                onClick={() => {
                  create.mutate();
                }}
              >
                Criar formulário
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {items.length > 1 || canEdit ? (
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-6">
          {items.length > 1 ? (
            <SelectNative
              aria-label="Formulário da List"
              className="max-w-xs"
              value={form.id}
              onChange={(change) => {
                setPickedId(change.target.value);
              }}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </SelectNative>
          ) : null}

          <span className="text-[12.5px] text-muted">
            {form.submissionCount === 1
              ? '1 envio recebido'
              : `${String(form.submissionCount)} envios recebidos`}
            {form.active ? '' : ' · desativado'}
          </span>

          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={create.isPending}
              onClick={() => {
                create.mutate();
              }}
            >
              Novo formulário
            </Button>
          ) : null}
        </div>
      ) : null}

      <FormBuilder wsId={wsId} listId={listId} form={form} canEdit={canEdit} />
    </div>
  );
}
