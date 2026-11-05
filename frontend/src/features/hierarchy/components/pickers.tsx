import { Check } from 'lucide-react';
import { colorSwatch } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { NODE_COLORS, NODE_ICONS } from '../node-kinds';

const optionClass =
  'flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-muted peer-checked:border-accent peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent';

/** Escolha de cor: o hex vai para a API, a bolinha usa o token mais próximo. */
export function ColorPicker({
  value,
  onChange,
  name = 'color',
}: {
  value: string;
  onChange: (color: string) => void;
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-[13px] font-medium text-body">Cor</legend>
      <div className="flex flex-wrap gap-2">
        {NODE_COLORS.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
              className="peer sr-only"
            />
            <span className={optionClass} title={option.label}>
              <span className="sr-only">{option.label}</span>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md',
                  colorSwatch(option.value),
                )}
                aria-hidden="true"
              >
                {value === option.value ? (
                  <Check className="h-3.5 w-3.5 text-on-signal" aria-hidden="true" />
                ) : null}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Escolha de ícone do Space; "Sem ícone" devolve string vazia. */
export function IconPicker({
  value,
  onChange,
  name = 'icon',
}: {
  value: string;
  onChange: (icon: string) => void;
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-[13px] font-medium text-body">Ícone</legend>
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value=""
            checked={value === ''}
            onChange={() => {
              onChange('');
            }}
            className="peer sr-only"
          />
          <span className={cn(optionClass, 'w-auto px-3 text-[13px]')}>Sem ícone</span>
        </label>
        {NODE_ICONS.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
              className="peer sr-only"
            />
            <span className={optionClass} title={option.label}>
              <span className="sr-only">{option.label}</span>
              <option.Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
