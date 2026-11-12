import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type {
  ActionType,
  AutomationActionInput,
  AutomationConditionInput,
  AutomationLocationType,
  AutomationRecipe,
  AutomationTriggerInput,
  ConditionOp,
  StatusGroup,
  TaskPriority,
  TriggerType,
} from '@/api/types';
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
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { LocationSelect } from '@/features/hierarchy/components/location-select';
import { membersQuery } from '@/features/settings/api';
import { listStatusesQuery, tagsQuery } from '@/features/tasks/api';
import { templatesQuery } from '@/features/templates/api';
import { createAutomation } from '../api';
import {
  ACTION_FIELDS,
  ACTION_LABEL,
  ACTION_TYPES,
  CONDITION_FIELDS,
  CONDITION_OPS,
  CONDITION_OP_LABEL,
  TRIGGER_FIELDS,
  TRIGGER_LABEL,
  TRIGGER_TYPES,
  UNARY_OPS,
} from '../automation-fields';
import { missingRecipeFields, recipeDraft } from '../automation-model';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

const STATUS_GROUPS: StatusGroup[] = ['notStarted', 'active', 'done', 'closed'];

const STATUS_GROUP_LABEL: Record<StatusGroup, string> = {
  notStarted: 'Não iniciado',
  active: 'Em andamento',
  done: 'Concluído',
  closed: 'Fechado',
};

export interface AutomationBuilderProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receita escolhida; ausente começa em branco. */
  recipe?: AutomationRecipe;
}

interface Draft {
  name: string;
  locationType: AutomationLocationType;
  locationId: string;
  trigger: AutomationTriggerInput;
  conditions: AutomationConditionInput[];
  actions: AutomationActionInput[];
}

function emptyDraft(): Draft {
  return {
    name: '',
    locationType: 'list',
    locationId: '',
    trigger: { type: 'taskCreated', params: {} },
    conditions: [],
    actions: [{ type: 'assign', params: {} }],
  };
}

/** Lê um parâmetro do gatilho ou da ação sem perder o tipo do resto. */
function paramOf(params: Record<string, unknown> | undefined, key: string): unknown {
  return params?.[key];
}

/** Construtor Quando → Se → Então, com os campos que cada tipo pede. */
export function AutomationBuilder({ wsId, open, onOpenChange, recipe }: AutomationBuilderProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const members = useQuery({ ...membersQuery(wsId), enabled: open });
  const tags = useQuery({ ...tagsQuery(wsId), enabled: open });
  const templates = useQuery({ ...templatesQuery(wsId), enabled: open });
  const statuses = useQuery({
    ...listStatusesQuery(wsId, draft.locationType === 'list' ? draft.locationId : ''),
    enabled: open && draft.locationType === 'list' && draft.locationId !== '',
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(recipe ? { ...emptyDraft(), ...recipeDraft(recipe) } : emptyDraft());
  }, [open, recipe]);

  const create = useMutation({
    mutationFn: () =>
      createAutomation(wsId, {
        locationType: draft.locationType,
        locationId: draft.locationId,
        name: draft.name.trim(),
        active: true,
        trigger: draft.trigger,
        conditions: draft.conditions,
        actions: draft.actions,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'automations'] });
      toast.success('Automação criada e ativa.');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const people = (members.data ?? []).filter((member) => member.status === 'active');
  const triggerFields = TRIGGER_FIELDS[draft.trigger.type];
  const pending = recipe ? missingRecipeFields(recipe, draft.trigger, draft.actions) : [];
  const ready =
    draft.name.trim() !== '' &&
    draft.locationId !== '' &&
    draft.actions.length > 0 &&
    pending.length === 0;

  const setTrigger = (changes: Partial<AutomationTriggerInput>): void => {
    setDraft((current) => ({ ...current, trigger: { ...current.trigger, ...changes } }));
  };
  const setTriggerParam = (key: string, value: unknown): void => {
    setDraft((current) => ({
      ...current,
      trigger: {
        ...current.trigger,
        params: { ...current.trigger.params, [key]: value } as AutomationTriggerInput['params'],
      },
    }));
  };
  const setAction = (index: number, action: AutomationActionInput): void => {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((item, position) => (position === index ? action : item)),
    }));
  };
  const setActionParam = (index: number, key: string, value: unknown): void => {
    const action = draft.actions[index];

    if (!action) {
      return;
    }

    setAction(index, {
      ...action,
      params: { ...action.params, [key]: value } as AutomationActionInput['params'],
    });
  };

  /** Multiescolha de pessoas por checkbox nativo, em lista rolável. */
  const peopleField = (index: number, selected: string[], label: string): React.ReactElement => (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[12.5px] text-muted">{label}</legend>
      <div className="flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-xl border border-line p-2">
        {people.map((member) => (
          <label
            key={member.userId.id}
            className="flex min-h-11 items-center gap-2 text-[13px] text-body md:min-h-9"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={selected.includes(member.userId.id)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, member.userId.id]
                  : selected.filter((id) => id !== member.userId.id);

                setActionParam(index, 'userIds', next);
              }}
            />
            {member.userId.name}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{recipe ? recipe.name : 'Nova automação'}</DialogTitle>
          <DialogDescription>
            {recipe
              ? recipe.description
              : 'Escolha onde ela vale, o que a dispara, as condições e o que fazer.'}
          </DialogDescription>
        </DialogHeader>

        {create.isError ? <FormAlert>{errorMessage(create.error)}</FormAlert> : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="automation-name">Nome</Label>
            <Input
              id="automation-name"
              maxLength={160}
              value={draft.name}
              placeholder="Code review vira revisão"
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="automation-location">Onde</Label>
            <LocationSelect
              id="automation-location"
              wsId={wsId}
              allow={['space', 'folder', 'list']}
              value={{
                location: draft.locationType,
                locationId: draft.locationId || undefined,
              }}
              onChange={(value) => {
                setDraft((current) => ({
                  ...current,
                  locationType: (value.location === 'everything'
                    ? 'space'
                    : value.location) as AutomationLocationType,
                  locationId: value.locationId ?? '',
                }));
              }}
            />
          </div>

          <section className="flex flex-col gap-2 rounded-2xl border border-line p-3">
            <h3 className="text-[11.5px] font-bold tracking-wider text-muted">QUANDO</h3>
            <SelectNative
              aria-label="Gatilho"
              value={draft.trigger.type}
              onChange={(event) => {
                setTrigger({ type: event.target.value as TriggerType, params: {} });
              }}
            >
              {TRIGGER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TRIGGER_LABEL[type]}
                </option>
              ))}
            </SelectNative>

            {triggerFields.includes('toStatus') ? (
              draft.locationType === 'list' && (statuses.data?.statuses.length ?? 0) > 0 ? (
                <SelectNative
                  aria-label="Status de destino"
                  value={String(paramOf(draft.trigger.params, 'toStatusId') ?? '')}
                  onChange={(event) => {
                    setTriggerParam('toStatusId', event.target.value || undefined);
                  }}
                >
                  <option value="">Escolha o status</option>
                  {(statuses.data?.statuses ?? []).map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </SelectNative>
              ) : (
                <SelectNative
                  aria-label="Grupo de status de destino"
                  value={String(paramOf(draft.trigger.params, 'toStatusGroup') ?? '')}
                  onChange={(event) => {
                    setTriggerParam('toStatusGroup', event.target.value || undefined);
                  }}
                >
                  <option value="">Qualquer status</option>
                  {STATUS_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {STATUS_GROUP_LABEL[group]}
                    </option>
                  ))}
                </SelectNative>
              )
            ) : null}

            {triggerFields.includes('beforeMinutes') ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="automation-before">Antecedência (minutos)</Label>
                <Input
                  id="automation-before"
                  type="number"
                  min={0}
                  max={43200}
                  value={String(paramOf(draft.trigger.params, 'beforeMinutes') ?? 0)}
                  onChange={(event) => {
                    setTriggerParam('beforeMinutes', Number(event.target.value) || 0);
                  }}
                />
              </div>
            ) : null}

            {triggerFields.includes('cron') ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="automation-cron">Expressão cron</Label>
                <Input
                  id="automation-cron"
                  value={String(paramOf(draft.trigger.params, 'cron') ?? '')}
                  placeholder="0 8 * * 1"
                  onChange={(event) => {
                    setTriggerParam('cron', event.target.value);
                  }}
                />
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-line p-3">
            <h3 className="text-[11.5px] font-bold tracking-wider text-muted">SE (opcional)</h3>

            {draft.conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <SelectNative
                  aria-label={`Campo da condição ${String(index + 1)}`}
                  className="w-auto flex-1 basis-[140px]"
                  value={condition.field}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, position) =>
                        position === index ? { ...item, field: event.target.value } : item,
                      ),
                    }));
                  }}
                >
                  {CONDITION_FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </SelectNative>

                <SelectNative
                  aria-label={`Operador da condição ${String(index + 1)}`}
                  className="w-auto flex-1 basis-[130px]"
                  value={condition.op}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, position) =>
                        position === index
                          ? { ...item, op: event.target.value as ConditionOp }
                          : item,
                      ),
                    }));
                  }}
                >
                  {CONDITION_OPS.map((op) => (
                    <option key={op} value={op}>
                      {CONDITION_OP_LABEL[op]}
                    </option>
                  ))}
                </SelectNative>

                {UNARY_OPS.includes(condition.op) ? null : (
                  <Input
                    aria-label={`Valor da condição ${String(index + 1)}`}
                    className="w-auto flex-1 basis-[130px]"
                    value={String(condition.value ?? '')}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        conditions: current.conditions.map((item, position) =>
                          position === index ? { ...item, value: event.target.value } : item,
                        ),
                      }));
                    }}
                  />
                )}

                <Button
                  variant="nav"
                  size="icon"
                  aria-label={`Remover condição ${String(index + 1)}`}
                  onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.filter(
                        (_item, position) => position !== index,
                      ),
                    }));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}

            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  conditions: [...current.conditions, { field: 'priority', op: 'eq', value: '' }],
                }));
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Condição
            </Button>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-line p-3">
            <h3 className="text-[11.5px] font-bold tracking-wider text-accent">ENTÃO</h3>

            {draft.actions.map((action, index) => {
              const fields = ACTION_FIELDS[action.type];
              const selectedUsers = Array.isArray(paramOf(action.params, 'userIds'))
                ? (paramOf(action.params, 'userIds') as string[])
                : [];

              return (
                <div
                  key={index}
                  className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-end gap-2">
                    <SelectNative
                      aria-label={`Ação ${String(index + 1)}`}
                      value={action.type}
                      onChange={(event) => {
                        setAction(index, { type: event.target.value as ActionType, params: {} });
                      }}
                    >
                      {ACTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {ACTION_LABEL[type]}
                        </option>
                      ))}
                    </SelectNative>
                    {draft.actions.length > 1 ? (
                      <Button
                        variant="nav"
                        size="icon"
                        aria-label={`Remover ação ${String(index + 1)}`}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            actions: current.actions.filter(
                              (_item, position) => position !== index,
                            ),
                          }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>

                  {fields.includes('status') ? (
                    <SelectNative
                      aria-label={`Status da ação ${String(index + 1)}`}
                      value={String(paramOf(action.params, 'statusGroup') ?? '')}
                      onChange={(event) => {
                        setActionParam(index, 'statusGroup', event.target.value || undefined);
                      }}
                    >
                      <option value="">Escolha o grupo de status</option>
                      {STATUS_GROUPS.map((group) => (
                        <option key={group} value={group}>
                          {STATUS_GROUP_LABEL[group]}
                        </option>
                      ))}
                    </SelectNative>
                  ) : null}

                  {fields.includes('users') ? peopleField(index, selectedUsers, 'Pessoas') : null}

                  {fields.includes('priority') ? (
                    <SelectNative
                      aria-label={`Prioridade da ação ${String(index + 1)}`}
                      value={String(paramOf(action.params, 'priority') ?? '')}
                      onChange={(event) => {
                        setActionParam(index, 'priority', event.target.value || undefined);
                      }}
                    >
                      <option value="">Escolha a prioridade</option>
                      {PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {PRIORITY_LABEL[priority]}
                        </option>
                      ))}
                    </SelectNative>
                  ) : null}

                  {fields.includes('comment') ? (
                    <Textarea
                      aria-label={`Comentário da ação ${String(index + 1)}`}
                      rows={2}
                      value={String(paramOf(action.params, 'bodyText') ?? '')}
                      placeholder="Tarefa {{task.customId}} pronta para revisão."
                      onChange={(event) => {
                        setActionParam(index, 'bodyText', event.target.value);
                      }}
                    />
                  ) : null}

                  {fields.includes('message') ? (
                    <Input
                      aria-label={`Mensagem da ação ${String(index + 1)}`}
                      value={String(paramOf(action.params, 'message') ?? '')}
                      placeholder="A tarefa {{task.customId}} precisa de você."
                      onChange={(event) => {
                        setActionParam(index, 'message', event.target.value);
                      }}
                    />
                  ) : null}

                  {fields.includes('list') ? (
                    <LocationSelect
                      wsId={wsId}
                      allow={['list']}
                      value={{
                        location: 'list',
                        locationId: String(paramOf(action.params, 'listId') ?? '') || undefined,
                      }}
                      onChange={(value) => {
                        setActionParam(index, 'listId', value.locationId);
                      }}
                    />
                  ) : null}

                  {fields.includes('taskName') ? (
                    <Input
                      aria-label={`Nome da tarefa da ação ${String(index + 1)}`}
                      value={String(paramOf(action.params, 'name') ?? '')}
                      placeholder="Revisar {{task.name}}"
                      onChange={(event) => {
                        setActionParam(index, 'name', event.target.value);
                      }}
                    />
                  ) : null}

                  {fields.includes('tags') ? (
                    <SelectNative
                      aria-label={`Tag da ação ${String(index + 1)}`}
                      value={
                        Array.isArray(paramOf(action.params, 'tagIds'))
                          ? String((paramOf(action.params, 'tagIds') as string[])[0] ?? '')
                          : ''
                      }
                      onChange={(event) => {
                        setActionParam(
                          index,
                          'tagIds',
                          event.target.value ? [event.target.value] : [],
                        );
                      }}
                    >
                      <option value="">Escolha a tag</option>
                      {(tags.data ?? []).map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </SelectNative>
                  ) : null}

                  {fields.includes('template') ? (
                    <SelectNative
                      aria-label={`Template da ação ${String(index + 1)}`}
                      value={String(paramOf(action.params, 'templateId') ?? '')}
                      onChange={(event) => {
                        setActionParam(index, 'templateId', event.target.value || undefined);
                      }}
                    >
                      <option value="">Escolha o template</option>
                      {(templates.data ?? []).map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </SelectNative>
                  ) : null}

                  {fields.includes('webhook') ? (
                    <Input
                      aria-label={`URL da ação ${String(index + 1)}`}
                      type="url"
                      value={String(paramOf(action.params, 'url') ?? '')}
                      placeholder="https://exemplo.com/hook"
                      onChange={(event) => {
                        setActionParam(index, 'url', event.target.value);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  actions: [...current.actions, { type: 'addComment', params: {} }],
                }));
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ação
            </Button>
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={!ready || create.isPending}
            onClick={() => {
              create.mutate();
            }}
          >
            {create.isPending ? <Spinner label="Salvando" /> : 'Salvar e ativar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
