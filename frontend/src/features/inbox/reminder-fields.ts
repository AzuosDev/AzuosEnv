import type { ReminderRecurrence } from '@/api/types';

export const RECURRENCE_LABEL: Record<ReminderRecurrence, string> = {
  none: 'Não repetir',
  daily: 'Todos os dias',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
};

export const RECURRENCE_ORDER: ReminderRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];

export const RECURRENCE_OPTIONS = RECURRENCE_ORDER.map((value) => ({
  value,
  label: RECURRENCE_LABEL[value],
}));
