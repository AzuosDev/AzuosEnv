import type {
  FormConditionInput,
  FormConditionOp,
  FormFieldInput,
  FormFieldKind,
  PublicFormCondition,
  PublicFormField,
  WorkspaceForm,
} from '@/api/types';

export const FORM_FIELD_KINDS: FormFieldKind[] = [
  'text',
  'longText',
  'number',
  'email',
  'phone',
  'url',
  'date',
  'dropdown',
  'labels',
  'checkbox',
];

export const FORM_FIELD_LABEL: Record<FormFieldKind, string> = {
  text: 'Texto curto',
  longText: 'Texto longo',
  number: 'Número',
  email: 'E-mail',
  phone: 'Telefone',
  url: 'Endereço (URL)',
  date: 'Data',
  dropdown: 'Escolha única',
  labels: 'Escolha múltipla',
  checkbox: 'Sim/Não',
};

/** Campos da tarefa que uma pergunta pode preencher, como o contrato aceita. */
export const MAP_TARGETS = ['name', 'description', 'priority', 'dueAt', 'assignee'] as const;

export const MAP_TARGET_LABEL: Record<(typeof MAP_TARGETS)[number], string> = {
  name: 'Nome da tarefa',
  description: 'Descrição',
  priority: 'Prioridade',
  dueAt: 'Prazo',
  assignee: 'Responsável',
};

export const CONDITION_OPS: FormConditionOp[] = [
  'eq',
  'ne',
  'contains',
  'gt',
  'lt',
  'isEmpty',
  'isNotEmpty',
];

export const CONDITION_OP_LABEL: Record<FormConditionOp, string> = {
  eq: 'é igual a',
  ne: 'é diferente de',
  contains: 'contém',
  gt: 'é maior que',
  lt: 'é menor que',
  isEmpty: 'está vazio',
  isNotEmpty: 'está preenchido',
};

/** Operadores que não comparam valor: o campo de valor desaparece. */
export function opNeedsValue(op: FormConditionOp): boolean {
  return op !== 'isEmpty' && op !== 'isNotEmpty';
}

export function kindNeedsOptions(kind: FormFieldKind): boolean {
  return kind === 'dropdown' || kind === 'labels';
}

/** Id estável e curto da pergunta; as respostas viajam por ele. */
export function newFieldId(existing: FormFieldInput[]): string {
  let index = existing.length + 1;

  while (existing.some((field) => field.id === `q${String(index)}`)) {
    index += 1;
  }

  return `q${String(index)}`;
}

export function emptyField(existing: FormFieldInput[]): FormFieldInput {
  return {
    id: newFieldId(existing),
    label: 'Nova pergunta',
    type: 'text',
    required: false,
    options: [],
    mapTo: null,
  };
}

/** Troca a pergunta de lugar; fora da lista nada muda. */
export function moveField(
  fields: FormFieldInput[],
  index: number,
  delta: number,
): FormFieldInput[] {
  const next = index + delta;

  if (index < 0 || index >= fields.length || next < 0 || next >= fields.length) {
    return fields;
  }

  const copy = [...fields];
  const [moved] = copy.splice(index, 1);

  if (moved) {
    copy.splice(next, 0, moved);
  }

  return copy;
}

/** Tira a pergunta e, com ela, as condições que a citavam. */
export function removeField(
  fields: FormFieldInput[],
  conditions: FormConditionInput[],
  fieldId: string,
): { fields: FormFieldInput[]; conditions: FormConditionInput[] } {
  return {
    fields: fields.filter((field) => field.id !== fieldId),
    conditions: conditions
      .filter((condition) => condition.fieldId !== fieldId)
      .map((condition) => ({
        ...condition,
        showFieldIds: condition.showFieldIds.filter((id) => id !== fieldId),
      }))
      .filter((condition) => condition.showFieldIds.length > 0),
  };
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return Array.isArray(value) ? value.map((item) => String(item)).join(',') : String(value);
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.parseFloat(asText(value));
}

function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === false) {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

/** Mesma regra do backend, para a tela esconder a pergunta na hora. */
export function matchesCondition(
  condition: Pick<PublicFormCondition, 'op' | 'value'>,
  answer: unknown,
): boolean {
  switch (condition.op) {
    case 'eq':
      return asText(answer) === asText(condition.value);
    case 'ne':
      return asText(answer) !== asText(condition.value);
    case 'contains':
      return asText(answer).toLowerCase().includes(asText(condition.value).toLowerCase());
    case 'gt':
      return asNumber(answer) > asNumber(condition.value);
    case 'lt':
      return asNumber(answer) < asNumber(condition.value);
    case 'isEmpty':
      return isEmptyAnswer(answer);
    case 'isNotEmpty':
      return !isEmptyAnswer(answer);
  }
}

/**
 * Perguntas que a pessoa vê de fato: toda pergunta citada por uma condição
 * começa escondida e só aparece quando a condição bate.
 */
export function visibleFieldIds(
  fieldIds: string[],
  conditions: Pick<PublicFormCondition, 'fieldId' | 'op' | 'value' | 'showFieldIds'>[],
  values: Record<string, unknown>,
): Set<string> {
  const conditional = new Set(conditions.flatMap((condition) => condition.showFieldIds));
  const visible = new Set(fieldIds.filter((fieldId) => !conditional.has(fieldId)));

  for (const condition of conditions) {
    if (!matchesCondition(condition, values[condition.fieldId])) {
      continue;
    }

    for (const fieldId of condition.showFieldIds) {
      if (fieldIds.includes(fieldId)) {
        visible.add(fieldId);
      }
    }
  }

  return visible;
}

/** Perguntas obrigatórias e visíveis que ainda estão em branco. */
export function missingAnswers(
  fields: PublicFormField[],
  conditions: PublicFormCondition[],
  values: Record<string, unknown>,
): string[] {
  const visible = visibleFieldIds(
    fields.map((field) => field.id),
    conditions,
    values,
  );

  return fields
    .filter(
      (field) =>
        field.required &&
        visible.has(field.id) &&
        field.type !== 'checkbox' &&
        isEmptyAnswer(values[field.id]),
    )
    .map((field) => field.id);
}

/** Só as respostas das perguntas visíveis vão para a API. */
export function answersToSend(
  fields: PublicFormField[],
  conditions: PublicFormCondition[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const visible = visibleFieldIds(
    fields.map((field) => field.id),
    conditions,
    values,
  );
  const body: Record<string, unknown> = {};

  for (const field of fields) {
    if (visible.has(field.id) && !isEmptyAnswer(values[field.id])) {
      body[field.id] = values[field.id];
    }
  }

  return body;
}

/** O link público é montado no front: /f/<token> é a tela do app. */
export function publicFormUrl(token: string, origin = window.location.origin): string {
  return `${origin.replace(/\/+$/, '')}/f/${token}`;
}

/** Código para incorporar o formulário em outro site. */
export function embedCode(url: string, title: string): string {
  return `<iframe src="${url}" title="${title.replace(/"/g, '&quot;')}" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy"></iframe>`;
}

/** O token volta uma única vez, na criação; o navegador guarda o link. */
export function linkStorageKey(formId: string): string {
  return `azuos-env:form-link:${formId}`;
}

export function rememberFormLink(formId: string, url: string): void {
  try {
    window.localStorage.setItem(linkStorageKey(formId), url);
  } catch {
    /* navegador sem armazenamento: o link fica só nesta sessão */
  }
}

export function recallFormLink(formId: string): string | null {
  try {
    return window.localStorage.getItem(linkStorageKey(formId));
  } catch {
    return null;
  }
}

/** Perguntas do construtor no formato que a tela pública desenha. */
export function toPublicFields(fields: FormFieldInput[]): PublicFormField[] {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    options: (field.options ?? []).map((option) => ({ id: option.id, label: option.label })),
  }));
}

export function toPublicConditions(conditions: FormConditionInput[]): PublicFormCondition[] {
  return conditions.map((condition) => ({
    fieldId: condition.fieldId,
    op: condition.op,
    value: condition.value,
    showFieldIds: condition.showFieldIds,
  }));
}

/** Perguntas do formulário salvo de volta ao formato do construtor. */
export function toFieldInputs(form: WorkspaceForm): FormFieldInput[] {
  return form.fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options.map((option) => ({ id: option.id, label: option.label })),
    mapTo: field.mapTo,
  }));
}

export function toConditionInputs(form: WorkspaceForm): FormConditionInput[] {
  return form.conditions.map((condition) => ({
    fieldId: condition.fieldId,
    op: condition.op,
    value: condition.value,
    showFieldIds: condition.showFieldIds,
  }));
}
