import { useId } from 'react';
import type { CustomField, FieldFilter, FieldFilterOp, TaskFilters } from '@/api/types';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import {
  FILTER_OP_LABEL,
  NUMERIC_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  TEXT_FIELD_TYPES,
  fieldFilterOps,
  optionsOf,
} from '@/features/tasks/field-values';
import { dayToIso, isoToDay, setFieldFilter } from '../filters';

export interface FieldFilterRowsProps {
  fields: CustomField[];
  filters: TaskFilters;
  onChange: (fieldFilters: FieldFilter[]) => void;
}

const ANY = 'any';

function filterOf(filters: TaskFilters, fieldId: string): FieldFilter | undefined {
  return (filters.fieldFilters ?? []).find((filter) => filter.fieldId === fieldId);
}

/** Controle do valor comparado, escolhido pelo tipo do campo e pelo operador. */
function ValueInput({
  field,
  filter,
  onValue,
}: {
  field: CustomField;
  filter: FieldFilter;
  onValue: (value: unknown) => void;
}) {
  const label = `Valor de ${field.name}`;

  if (filter.op === 'isEmpty') {
    return (
      <SelectNative
        aria-label={label}
        className="h-11 text-[13px] md:h-9"
        value={filter.value === false ? 'filled' : 'empty'}
        onChange={(event) => {
          onValue(event.target.value === 'empty');
        }}
      >
        <option value="empty">Vazio</option>
        <option value="filled">Preenchido</option>
      </SelectNative>
    );
  }

  if (OPTION_FIELD_TYPES.includes(field.type)) {
    return (
      <SelectNative
        aria-label={label}
        className="h-11 text-[13px] md:h-9"
        value={typeof filter.value === 'string' ? filter.value : ''}
        onChange={(event) => {
          onValue(event.target.value);
        }}
      >
        <option value="">Escolha a opção</option>
        {optionsOf(field).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </SelectNative>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <SelectNative
        aria-label={label}
        className="h-11 text-[13px] md:h-9"
        value={filter.value === true ? 'true' : 'false'}
        onChange={(event) => {
          onValue(event.target.value === 'true');
        }}
      >
        <option value="true">Marcado</option>
        <option value="false">Desmarcado</option>
      </SelectNative>
    );
  }

  if (field.type === 'date') {
    return (
      <Input
        type="date"
        aria-label={label}
        className="h-11 text-[13px] md:h-9"
        value={isoToDay(typeof filter.value === 'string' ? filter.value : undefined)}
        onChange={(event) => {
          onValue(dayToIso(event.target.value, filter.op === 'lt' ? 'end' : 'start') ?? '');
        }}
      />
    );
  }

  if (NUMERIC_FIELD_TYPES.includes(field.type) || field.type === 'formula') {
    return (
      <Input
        inputMode="decimal"
        aria-label={label}
        className="h-11 text-[13px] md:h-9"
        value={filter.value === undefined ? '' : String(filter.value)}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(',', '.'));

          onValue(event.target.value === '' || !Number.isFinite(parsed) ? '' : parsed);
        }}
      />
    );
  }

  if (TEXT_FIELD_TYPES.includes(field.type)) {
    return (
      <Input
        aria-label={label}
        className="h-11 text-[13px] md:h-9"
        value={filter.value === undefined ? '' : String(filter.value)}
        onChange={(event) => {
          onValue(event.target.value);
        }}
      />
    );
  }

  return null;
}

/** Um filtro por campo personalizado: operador e valor, dentro do popover. */
export function FieldFilterRows({ fields, filters, onChange }: FieldFilterRowsProps) {
  const groupId = useId();

  if (fields.length === 0) {
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={groupId}>
      <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Campos personalizados
      </legend>

      {fields.map((field) => {
        const current = filterOf(filters, field.id);
        const ops: FieldFilterOp[] = fieldFilterOps(field.type);

        return (
          <div key={field.id} className="flex flex-col gap-1.5">
            <span className="min-w-0 truncate text-[13px] text-body">{field.name}</span>

            <SelectNative
              aria-label={`Filtro de ${field.name}`}
              className="h-11 text-[13px] md:h-9"
              value={current?.op ?? ANY}
              onChange={(event) => {
                const op = event.target.value;

                onChange(
                  setFieldFilter(
                    filters.fieldFilters,
                    op === ANY
                      ? null
                      : {
                          fieldId: field.id,
                          op: op as FieldFilterOp,
                          ...(op === 'isEmpty' ? { value: true } : {}),
                        },
                    field.id,
                  ),
                );
              }}
            >
              <option value={ANY}>Qualquer valor</option>
              {ops.map((op) => (
                <option key={op} value={op}>
                  {FILTER_OP_LABEL[op]}
                </option>
              ))}
            </SelectNative>

            {current ? (
              <ValueInput
                field={field}
                filter={current}
                onValue={(value) => {
                  onChange(
                    setFieldFilter(
                      filters.fieldFilters,
                      { fieldId: field.id, op: current.op, value },
                      field.id,
                    ),
                  );
                }}
              />
            ) : null}
          </div>
        );
      })}

      <p id={groupId} className="text-[12px] text-muted">
        Os filtros de campo somam com os outros: a tarefa precisa passar por todos.
      </p>
    </fieldset>
  );
}
