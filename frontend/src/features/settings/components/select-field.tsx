import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { SelectNative } from '@/components/ui/select-native';
import { Field } from '@/features/auth/components/field';
import type { Option } from '../options';

export interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: Option[];
  error?: string;
  hint?: string;
}

/** Select nativo ligado ao react-hook-form, com label e erro. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  error,
  hint,
}: SelectFieldProps<T>) {
  const { field } = useController({ control, name });

  return (
    <Field id={name} label={label} error={error} {...(hint ? { hint } : {})}>
      <SelectNative
        id={name}
        name={field.name}
        ref={field.ref}
        value={String(field.value ?? '')}
        onChange={field.onChange}
        onBlur={field.onBlur}
        aria-invalid={Boolean(error)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectNative>
    </Field>
  );
}
