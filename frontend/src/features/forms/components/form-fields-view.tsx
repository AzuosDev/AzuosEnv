import type { PublicFormCondition, PublicFormField } from '@/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { visibleFieldIds } from '../form-model';

export type FormValues = Record<string, unknown>;

export interface FormFieldsViewProps {
  fields: PublicFormField[];
  conditions: PublicFormCondition[];
  values: FormValues;
  onChange: (fieldId: string, value: unknown) => void;
  /** Ids das perguntas obrigatórias que ficaram em branco no último envio. */
  missing?: string[];
  disabled?: boolean;
  /** Prefixo dos ids do HTML, para a prévia e a tela pública conviverem. */
  idPrefix?: string;
}

const TEXT_INPUT_TYPE: Partial<Record<PublicFormField['type'], string>> = {
  number: 'number',
  email: 'email',
  phone: 'tel',
  url: 'url',
  date: 'date',
};

/**
 * As perguntas do formulário. É o mesmo desenho na prévia do construtor e na
 * página pública, então o que o cliente vê é o que a equipe configurou.
 */
export function FormFieldsView({
  fields,
  conditions,
  values,
  onChange,
  missing = [],
  disabled = false,
  idPrefix = 'form',
}: FormFieldsViewProps) {
  const visible = visibleFieldIds(
    fields.map((field) => field.id),
    conditions,
    values,
  );

  return (
    <div className="flex flex-col gap-5">
      {fields
        .filter((field) => visible.has(field.id))
        .map((field) => {
          const id = `${idPrefix}-${field.id}`;
          const invalid = missing.includes(field.id);
          const value = values[field.id];

          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {field.type === 'checkbox' ? (
                <label className="flex min-h-11 items-center gap-3 text-[13px] text-body">
                  <Checkbox
                    id={id}
                    checked={value === true}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      onChange(field.id, checked === true);
                    }}
                  />
                  <span className="font-semibold text-ink">{field.label}</span>
                </label>
              ) : (
                <>
                  <Label htmlFor={id} className="text-[13px] font-semibold">
                    {field.label}{' '}
                    {field.required ? (
                      <span className="font-normal text-muted">obrigatório</span>
                    ) : null}
                  </Label>

                  {field.type === 'longText' ? (
                    <Textarea
                      id={id}
                      rows={5}
                      disabled={disabled}
                      aria-invalid={invalid}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(change) => {
                        onChange(field.id, change.target.value);
                      }}
                      className={cn(invalid && 'border-danger')}
                    />
                  ) : null}

                  {field.type === 'dropdown' ? (
                    <SelectNative
                      id={id}
                      disabled={disabled}
                      aria-invalid={invalid}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(change) => {
                        onChange(field.id, change.target.value);
                      }}
                      className={cn('h-12', invalid && 'border-danger')}
                    >
                      <option value="">Escolha uma opção</option>
                      {field.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </SelectNative>
                  ) : null}

                  {field.type === 'labels' ? (
                    <div
                      role="group"
                      aria-label={field.label}
                      className="flex flex-col gap-1.5 rounded-xl border border-line p-2"
                    >
                      {field.options.map((option) => {
                        const picked = Array.isArray(value) && value.includes(option.id);

                        return (
                          <label
                            key={option.id}
                            className="flex min-h-11 items-center gap-3 text-[13px] text-body"
                          >
                            <Checkbox
                              checked={picked}
                              disabled={disabled}
                              aria-label={option.label}
                              onCheckedChange={(checked) => {
                                const current = Array.isArray(value) ? [...value] : [];

                                onChange(
                                  field.id,
                                  checked === true
                                    ? [...current, option.id]
                                    : current.filter((item) => item !== option.id),
                                );
                              }}
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}

                  {field.type !== 'longText' &&
                  field.type !== 'dropdown' &&
                  field.type !== 'labels' ? (
                    <Input
                      id={id}
                      type={TEXT_INPUT_TYPE[field.type] ?? 'text'}
                      disabled={disabled}
                      aria-invalid={invalid}
                      value={
                        typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                      }
                      onChange={(change) => {
                        onChange(field.id, change.target.value);
                      }}
                      className={cn('h-12', invalid && 'border-danger')}
                    />
                  ) : null}
                </>
              )}

              {invalid ? (
                <span className="text-[12.5px] text-danger">Preencha este campo.</span>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}
