import type { RecurrenceMode, TaskRecurrence, TaskRecurrenceInput } from '@/api/types';

/** Frequências do editor amigável; `custom` entrega a regra crua. */
export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'custom';

export const RECURRENCE_FREQ_ORDER: RecurrenceFreq[] = ['daily', 'weekly', 'monthly', 'custom'];

export const RECURRENCE_FREQ_LABEL: Record<RecurrenceFreq, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  custom: 'Personalizada',
};

export const RECURRENCE_MODE_LABEL: Record<RecurrenceMode, string> = {
  onComplete: 'Ao concluir',
  onSchedule: 'Agendado',
};

export const RECURRENCE_MODE_HINT: Record<RecurrenceMode, string> = {
  onComplete: 'A próxima ocorrência nasce quando alguém conclui a tarefa.',
  onSchedule: 'A próxima ocorrência nasce na data da regra, mesmo sem conclusão.',
};

/** Códigos de dia da semana do iCalendar, de segunda a domingo. */
export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const WEEKDAY_LABEL: Record<WeekdayCode, string> = {
  MO: 'Seg',
  TU: 'Ter',
  WE: 'Qua',
  TH: 'Qui',
  FR: 'Sex',
  SA: 'Sáb',
  SU: 'Dom',
};

export interface RecurrenceDraft {
  freq: RecurrenceFreq;
  /** A cada quantos dias, semanas ou meses. */
  interval: number;
  weekdays: WeekdayCode[];
  /** Dia do mês na frequência mensal. */
  monthDay: number;
  /** Regra crua quando a frequência é personalizada. */
  custom: string;
  mode: RecurrenceMode;
  /** true cria a próxima ocorrência; false reabre a própria tarefa. */
  createNew: boolean;
}

export const MAX_INTERVAL = 365;

export function emptyRecurrenceDraft(): RecurrenceDraft {
  return {
    freq: 'weekly',
    interval: 1,
    weekdays: [],
    monthDay: 1,
    custom: '',
    mode: 'onComplete',
    createNew: true,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function parts(rrule: string): Map<string, string> {
  const map = new Map<string, string>();
  const body = rrule.trim().replace(/^RRULE:/i, '');

  for (const piece of body.split(';')) {
    const [key, value] = piece.split('=');

    if (key && value) {
      map.set(key.trim().toUpperCase(), value.trim().toUpperCase());
    }
  }

  return map;
}

function weekdaysOf(value: string | undefined): WeekdayCode[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter((code): code is WeekdayCode => (WEEKDAY_CODES as readonly string[]).includes(code));
}

/**
 * Regra do iCalendar a partir do editor. Devolve null quando o rascunho ainda
 * não descreve uma regra válida (semanal sem dia, personalizada vazia).
 */
export function toRrule(draft: RecurrenceDraft): string | null {
  const interval = clamp(draft.interval, 1, MAX_INTERVAL);

  if (draft.freq === 'custom') {
    const custom = draft.custom.trim();

    return custom === '' ? null : custom.replace(/^RRULE:/i, '');
  }

  if (draft.freq === 'daily') {
    return `FREQ=DAILY;INTERVAL=${String(interval)}`;
  }

  if (draft.freq === 'weekly') {
    if (draft.weekdays.length === 0) {
      return null;
    }

    const byDay = WEEKDAY_CODES.filter((code) => draft.weekdays.includes(code)).join(',');

    return `FREQ=WEEKLY;INTERVAL=${String(interval)};BYDAY=${byDay}`;
  }

  return `FREQ=MONTHLY;INTERVAL=${String(interval)};BYMONTHDAY=${String(
    clamp(draft.monthDay, 1, 31),
  )}`;
}

/** Rascunho do editor a partir da recorrência gravada na tarefa. */
export function toDraft(recurrence: TaskRecurrence | null | undefined): RecurrenceDraft {
  const draft = emptyRecurrenceDraft();

  if (!recurrence) {
    return draft;
  }

  const base: RecurrenceDraft = {
    ...draft,
    mode: recurrence.mode,
    createNew: recurrence.createNew,
    custom: recurrence.rrule,
  };
  const map = parts(recurrence.rrule);
  const freq = map.get('FREQ');
  const interval = clamp(Number(map.get('INTERVAL') ?? '1'), 1, MAX_INTERVAL);
  const extra = [...map.keys()].filter(
    (key) => !['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY'].includes(key),
  );

  if (extra.length > 0) {
    return { ...base, freq: 'custom' };
  }

  if (freq === 'DAILY' && !map.has('BYDAY') && !map.has('BYMONTHDAY')) {
    return { ...base, freq: 'daily', interval };
  }

  if (freq === 'WEEKLY' && !map.has('BYMONTHDAY')) {
    const weekdays = weekdaysOf(map.get('BYDAY'));

    return weekdays.length > 0
      ? { ...base, freq: 'weekly', interval, weekdays }
      : { ...base, freq: 'custom' };
  }

  if (freq === 'MONTHLY' && !map.has('BYDAY') && map.has('BYMONTHDAY')) {
    return {
      ...base,
      freq: 'monthly',
      interval,
      monthDay: clamp(Number(map.get('BYMONTHDAY')), 1, 31),
    };
  }

  return { ...base, freq: 'custom' };
}

/** Corpo que o PATCH da tarefa aceita, ou null quando o rascunho é inválido. */
export function toRecurrenceInput(draft: RecurrenceDraft): TaskRecurrenceInput | null {
  const rrule = toRrule(draft);

  return rrule === null ? null : { rrule, mode: draft.mode, createNew: draft.createNew };
}

function joinWeekdays(weekdays: WeekdayCode[]): string {
  const names = WEEKDAY_CODES.filter((code) => weekdays.includes(code)).map(
    (code) => WEEKDAY_LABEL[code],
  );

  if (names.length <= 1) {
    return names.join('');
  }

  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1] ?? ''}`;
}

/** A regra em uma frase pt-BR, para o resumo do painel. */
export function describeRecurrence(recurrence: TaskRecurrence | null | undefined): string {
  if (!recurrence) {
    return 'Sem recorrência';
  }

  const draft = toDraft(recurrence);
  const repeated = draft.interval > 1;
  const times = String(draft.interval);

  if (draft.freq === 'daily') {
    return repeated ? `A cada ${times} dias` : 'Todo dia';
  }

  if (draft.freq === 'weekly') {
    const days = joinWeekdays(draft.weekdays);

    return repeated ? `A cada ${times} semanas, ${days}` : `Toda semana, ${days}`;
  }

  if (draft.freq === 'monthly') {
    const day = String(draft.monthDay);

    return repeated ? `A cada ${times} meses, no dia ${day}` : `Todo mês, no dia ${day}`;
  }

  return `Regra personalizada (${recurrence.rrule})`;
}
