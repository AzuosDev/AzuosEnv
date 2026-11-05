import type { UserTheme } from '@/api/types';

export interface Option {
  value: string;
  label: string;
}

/** Fusos usados pela Azuos e pelos clientes; o valor salvo entra na lista se faltar. */
export const TIMEZONES: Option[] = [
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC−3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC−3)' },
  { value: 'America/Recife', label: 'Recife (UTC−3)' },
  { value: 'America/Bahia', label: 'Salvador (UTC−3)' },
  { value: 'America/Belem', label: 'Belém (UTC−3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC−4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC−4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC−5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC−2)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Nova York (UTC−5/−4)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (UTC+0/+1)' },
];

export const LOCALES: Option[] = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
];

export const THEME_OPTIONS: { value: UserTheme; label: string }[] = [
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

/** Garante que o valor salvo apareça no select mesmo fora da lista curada. */
export function withValue(options: Option[], value: string): Option[] {
  return options.some((option) => option.value === value)
    ? options
    : [{ value, label: value }, ...options];
}
