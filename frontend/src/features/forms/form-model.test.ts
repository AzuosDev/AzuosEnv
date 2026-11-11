import { describe, expect, it } from 'vitest';
import type { FormConditionInput, FormFieldInput, PublicFormCondition } from '@/api/types';
import {
  answersToSend,
  embedCode,
  emptyField,
  kindNeedsOptions,
  matchesCondition,
  missingAnswers,
  moveField,
  newFieldId,
  opNeedsValue,
  publicFormUrl,
  removeField,
  toPublicFields,
  visibleFieldIds,
} from './form-model';

const fields: FormFieldInput[] = [
  { id: 'q1', label: 'Nome', type: 'text', required: true, options: [], mapTo: 'name' },
  { id: 'q2', label: 'Tipo', type: 'dropdown', required: false, options: [], mapTo: null },
  { id: 'q3', label: 'Orçamento', type: 'number', required: true, options: [], mapTo: null },
];

const conditions: PublicFormCondition[] = [
  { fieldId: 'q2', op: 'eq', value: 'projeto', showFieldIds: ['q3'] },
];

describe('perguntas do construtor', () => {
  it('o id novo não repete nenhum existente', () => {
    expect(newFieldId(fields)).toBe('q4');
    expect(emptyField(fields).id).toBe('q4');
  });

  it('mover respeita as pontas da lista', () => {
    expect(moveField(fields, 0, 1).map((field) => field.id)).toEqual(['q2', 'q1', 'q3']);
    expect(moveField(fields, 0, -1)).toBe(fields);
    expect(moveField(fields, 2, 1)).toBe(fields);
  });

  it('excluir a pergunta leva as condições que a citavam', () => {
    const inputs: FormConditionInput[] = [
      { fieldId: 'q2', op: 'eq', value: 'projeto', showFieldIds: ['q3'] },
      { fieldId: 'q1', op: 'isNotEmpty', value: null, showFieldIds: ['q2'] },
    ];
    const result = removeField(fields, inputs, 'q3');

    expect(result.fields.map((field) => field.id)).toEqual(['q1', 'q2']);
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0]?.fieldId).toBe('q1');
  });

  it('só escolha única e múltipla pedem opções', () => {
    expect(kindNeedsOptions('dropdown')).toBe(true);
    expect(kindNeedsOptions('labels')).toBe(true);
    expect(kindNeedsOptions('text')).toBe(false);
  });

  it('vazio e preenchido não comparam valor', () => {
    expect(opNeedsValue('isEmpty')).toBe(false);
    expect(opNeedsValue('eq')).toBe(true);
  });
});

describe('condições', () => {
  it('cada operador compara como o backend', () => {
    expect(matchesCondition({ op: 'eq', value: 'a' }, 'a')).toBe(true);
    expect(matchesCondition({ op: 'ne', value: 'a' }, 'b')).toBe(true);
    expect(matchesCondition({ op: 'contains', value: 'PDV' }, 'quero um pdv novo')).toBe(true);
    expect(matchesCondition({ op: 'gt', value: 10 }, 11)).toBe(true);
    expect(matchesCondition({ op: 'lt', value: 10 }, 11)).toBe(false);
    expect(matchesCondition({ op: 'isEmpty', value: null }, '')).toBe(true);
    expect(matchesCondition({ op: 'isNotEmpty', value: null }, 'x')).toBe(true);
  });

  it('a pergunta citada começa escondida e aparece quando a condição bate', () => {
    const ids = fields.map((field) => field.id);

    expect([...visibleFieldIds(ids, conditions, {})]).toEqual(['q1', 'q2']);
    expect([...visibleFieldIds(ids, conditions, { q2: 'projeto' })]).toContain('q3');
  });
});

describe('envio', () => {
  const publicFields = toPublicFields(fields);

  it('obrigatória escondida não bloqueia o envio', () => {
    expect(missingAnswers(publicFields, conditions, { q1: 'Ana' })).toEqual([]);
  });

  it('obrigatória visível em branco bloqueia', () => {
    expect(missingAnswers(publicFields, conditions, {})).toEqual(['q1']);
    expect(missingAnswers(publicFields, conditions, { q1: 'Ana', q2: 'projeto' })).toEqual(['q3']);
  });

  it('só as respostas visíveis e preenchidas viajam', () => {
    expect(answersToSend(publicFields, conditions, { q1: 'Ana', q3: 5 })).toEqual({ q1: 'Ana' });
    expect(answersToSend(publicFields, conditions, { q1: 'Ana', q2: 'projeto', q3: 5 })).toEqual({
      q1: 'Ana',
      q2: 'projeto',
      q3: 5,
    });
  });
});

describe('link público', () => {
  it('o endereço é a rota /f/<token> do app', () => {
    expect(publicFormUrl('abc', 'https://env.azuos.dev/')).toBe('https://env.azuos.dev/f/abc');
  });

  it('o código de incorporação leva o endereço e escapa o título', () => {
    const code = embedCode('https://env.azuos.dev/f/abc', 'Diga "oi"');

    expect(code).toContain('src="https://env.azuos.dev/f/abc"');
    expect(code).toContain('&quot;oi&quot;');
  });
});
