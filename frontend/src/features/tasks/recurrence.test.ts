import { describe, expect, it } from 'vitest';
import type { TaskRecurrence } from '@/api/types';
import {
  describeRecurrence,
  emptyRecurrenceDraft,
  toDraft,
  toRecurrenceInput,
  toRrule,
} from './recurrence';

function recurrence(rrule: string, extra: Partial<TaskRecurrence> = {}): TaskRecurrence {
  return { rrule, mode: 'onComplete', createNew: true, ...extra };
}

describe('toRrule', () => {
  it('monta a regra diária com o intervalo', () => {
    expect(toRrule({ ...emptyRecurrenceDraft(), freq: 'daily', interval: 3 })).toBe(
      'FREQ=DAILY;INTERVAL=3',
    );
  });

  it('monta a semanal com os dias na ordem da semana', () => {
    expect(
      toRrule({
        ...emptyRecurrenceDraft(),
        freq: 'weekly',
        interval: 2,
        weekdays: ['WE', 'MO'],
      }),
    ).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE');
  });

  it('não devolve regra semanal sem nenhum dia escolhido', () => {
    expect(toRrule({ ...emptyRecurrenceDraft(), freq: 'weekly', weekdays: [] })).toBeNull();
  });

  it('monta a mensal com o dia do mês', () => {
    expect(toRrule({ ...emptyRecurrenceDraft(), freq: 'monthly', monthDay: 5 })).toBe(
      'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5',
    );
  });

  it('entrega a regra crua da personalizada, sem o prefixo RRULE', () => {
    expect(
      toRrule({ ...emptyRecurrenceDraft(), freq: 'custom', custom: 'RRULE:FREQ=YEARLY' }),
    ).toBe('FREQ=YEARLY');
  });

  it('segura o intervalo no mínimo de 1', () => {
    expect(toRrule({ ...emptyRecurrenceDraft(), freq: 'daily', interval: 0 })).toBe(
      'FREQ=DAILY;INTERVAL=1',
    );
  });
});

describe('toDraft', () => {
  it('volta da regra semanal para o editor', () => {
    const draft = toDraft(recurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR'));

    expect(draft.freq).toBe('weekly');
    expect(draft.interval).toBe(2);
    expect(draft.weekdays).toEqual(['MO', 'FR']);
  });

  it('volta da mensal com o dia do mês', () => {
    const draft = toDraft(recurrence('FREQ=MONTHLY;BYMONTHDAY=12'));

    expect(draft.freq).toBe('monthly');
    expect(draft.monthDay).toBe(12);
    expect(draft.interval).toBe(1);
  });

  it('cai em personalizada quando a regra usa o que o editor não desenha', () => {
    const draft = toDraft(recurrence('FREQ=WEEKLY;BYDAY=MO;COUNT=10'));

    expect(draft.freq).toBe('custom');
    expect(draft.custom).toBe('FREQ=WEEKLY;BYDAY=MO;COUNT=10');
  });

  it('mantém modo e createNew da tarefa', () => {
    const draft = toDraft(recurrence('FREQ=DAILY', { mode: 'onSchedule', createNew: false }));

    expect(draft.mode).toBe('onSchedule');
    expect(draft.createNew).toBe(false);
  });

  it('ida e volta da semanal não muda a regra', () => {
    const rrule = 'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH';

    expect(toRrule(toDraft(recurrence(rrule)))).toBe(rrule);
  });
});

describe('toRecurrenceInput', () => {
  it('devolve o corpo do PATCH com modo e createNew', () => {
    expect(
      toRecurrenceInput({
        ...emptyRecurrenceDraft(),
        freq: 'daily',
        mode: 'onSchedule',
        createNew: false,
      }),
    ).toEqual({ rrule: 'FREQ=DAILY;INTERVAL=1', mode: 'onSchedule', createNew: false });
  });

  it('devolve null quando o rascunho não descreve regra', () => {
    expect(
      toRecurrenceInput({ ...emptyRecurrenceDraft(), freq: 'custom', custom: '  ' }),
    ).toBeNull();
  });
});

describe('describeRecurrence', () => {
  it('descreve a ausência de recorrência', () => {
    expect(describeRecurrence(null)).toBe('Sem recorrência');
  });

  it('descreve a semanal com os dias em português', () => {
    expect(describeRecurrence(recurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR'))).toBe(
      'Toda semana, Seg, Qua e Sex',
    );
  });

  it('descreve o intervalo maior que um', () => {
    expect(describeRecurrence(recurrence('FREQ=DAILY;INTERVAL=3'))).toBe('A cada 3 dias');
    expect(describeRecurrence(recurrence('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=9'))).toBe(
      'A cada 2 meses, no dia 9',
    );
  });

  it('mostra a regra crua quando é personalizada', () => {
    expect(describeRecurrence(recurrence('FREQ=YEARLY'))).toBe('Regra personalizada (FREQ=YEARLY)');
  });
});
