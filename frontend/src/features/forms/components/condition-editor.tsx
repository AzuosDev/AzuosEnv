import { Trash2 } from 'lucide-react';
import type { FormConditionInput, FormConditionOp, FormFieldInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { CONDITION_OPS, CONDITION_OP_LABEL, opNeedsValue } from '../form-model';

export interface ConditionEditorProps {
  fields: FormFieldInput[];
  conditions: FormConditionInput[];
  onChange: (conditions: FormConditionInput[]) => void;
}

/**
 * Condições do formulário: a pergunta citada em "mostra" fica escondida até a
 * condição bater. É a mesma regra que o backend confere no envio.
 */
export function ConditionEditor({ fields, conditions, onChange }: ConditionEditorProps) {
  const label = (fieldId: string): string =>
    fields.find((field) => field.id === fieldId)?.label ?? fieldId;

  return (
    <div className="flex flex-col gap-3">
      {conditions.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          Sem condições: todas as perguntas aparecem de uma vez.
        </p>
      ) : null}

      {conditions.map((condition, index) => (
        <div
          key={`${condition.fieldId}-${String(index)}`}
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Quando</span>
            <Button
              variant="nav"
              size="icon"
              className="ml-auto"
              aria-label={`Excluir condição de ${label(condition.fieldId)}`}
              onClick={() => {
                onChange(conditions.filter((_item, position) => position !== index));
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <SelectNative
            aria-label="Pergunta observada"
            value={condition.fieldId}
            onChange={(change) => {
              onChange(
                conditions.map((item, position) =>
                  position === index ? { ...item, fieldId: change.target.value } : item,
                ),
              );
            }}
          >
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </SelectNative>

          <SelectNative
            aria-label="Operador da condição"
            value={condition.op}
            onChange={(change) => {
              onChange(
                conditions.map((item, position) =>
                  position === index
                    ? { ...item, op: change.target.value as FormConditionOp }
                    : item,
                ),
              );
            }}
          >
            {CONDITION_OPS.map((op) => (
              <option key={op} value={op}>
                {CONDITION_OP_LABEL[op]}
              </option>
            ))}
          </SelectNative>

          {opNeedsValue(condition.op) ? (
            <Input
              aria-label="Valor comparado"
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={(change) => {
                onChange(
                  conditions.map((item, position) =>
                    position === index ? { ...item, value: change.target.value } : item,
                  ),
                );
              }}
            />
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label className="text-[12.5px]">Mostra</Label>
            {fields
              .filter((field) => field.id !== condition.fieldId)
              .map((field) => {
                const picked = condition.showFieldIds.includes(field.id);

                return (
                  <label
                    key={field.id}
                    className="flex min-h-11 items-center gap-2 text-[13px] text-body md:min-h-9"
                  >
                    <Checkbox
                      checked={picked}
                      aria-label={`Mostrar ${field.label}`}
                      onCheckedChange={(checked) => {
                        onChange(
                          conditions.map((item, position) =>
                            position === index
                              ? {
                                  ...item,
                                  showFieldIds:
                                    checked === true
                                      ? [...item.showFieldIds, field.id]
                                      : item.showFieldIds.filter((id) => id !== field.id),
                                }
                              : item,
                          ),
                        );
                      }}
                    />
                    {field.label}
                  </label>
                );
              })}
          </div>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={fields.length < 2}
        onClick={() => {
          const first = fields[0];

          if (!first) {
            return;
          }

          onChange([
            ...conditions,
            { fieldId: first.id, op: 'isNotEmpty', value: null, showFieldIds: [] },
          ]);
        }}
      >
        Nova condição
      </Button>
    </div>
  );
}
