import { BadRequestException } from '@nestjs/common';
import { assertRecurrence, nextOccurrence, nextOccurrenceDate } from './recurrence';

describe('recurrence', () => {
  describe('assertRecurrence', () => {
    it('aceita uma regra semanal', () => {
      expect(() => assertRecurrence('FREQ=WEEKLY;INTERVAL=1')).not.toThrow();
    });

    it('aceita a regra com o prefixo RRULE', () => {
      expect(() => assertRecurrence('RRULE:FREQ=MONTHLY;BYMONTHDAY=5')).not.toThrow();
    });

    it('recusa uma regra inválida', () => {
      expect(() => assertRecurrence('toda semana')).toThrow(BadRequestException);
    });

    it('recusa uma regra vazia', () => {
      expect(() => assertRecurrence('   ')).toThrow(BadRequestException);
    });
  });

  describe('nextOccurrenceDate', () => {
    it('semanal cai no mesmo dia da semana seguinte', () => {
      const anchor = new Date('2026-03-02T12:00:00.000Z');

      expect(nextOccurrenceDate('FREQ=WEEKLY', anchor, anchor)?.toISOString()).toBe(
        '2026-03-09T12:00:00.000Z',
      );
    });

    it('devolve null quando a regra terminou', () => {
      const anchor = new Date('2026-03-02T12:00:00.000Z');

      expect(nextOccurrenceDate('FREQ=WEEKLY;COUNT=1', anchor, anchor)).toBeNull();
    });
  });

  describe('nextOccurrence', () => {
    it('mantém a distância entre início e vencimento', () => {
      const now = new Date('2026-03-01T00:00:00.000Z');
      const next = nextOccurrence(
        'FREQ=WEEKLY',
        {
          startAt: new Date('2026-03-02T09:00:00.000Z'),
          dueAt: new Date('2026-03-04T18:00:00.000Z'),
        },
        now,
      );

      expect(next?.dueAt.toISOString()).toBe('2026-03-11T18:00:00.000Z');
      expect(next?.startAt?.toISOString()).toBe('2026-03-09T09:00:00.000Z');
    });

    it('sem data de início mantém o vencimento sozinho', () => {
      const now = new Date('2026-03-01T00:00:00.000Z');
      const next = nextOccurrence(
        'FREQ=DAILY;INTERVAL=3',
        { startAt: null, dueAt: new Date('2026-03-02T12:00:00.000Z') },
        now,
      );

      expect(next?.dueAt.toISOString()).toBe('2026-03-05T12:00:00.000Z');
      expect(next?.startAt).toBeNull();
    });

    it('tarefa atrasada pula para a próxima ocorrência depois de agora', () => {
      const next = nextOccurrence(
        'FREQ=WEEKLY',
        { startAt: null, dueAt: new Date('2026-03-02T12:00:00.000Z') },
        new Date('2026-03-18T00:00:00.000Z'),
      );

      expect(next?.dueAt.toISOString()).toBe('2026-03-23T12:00:00.000Z');
    });

    it('devolve null quando não há mais ocorrência', () => {
      const now = new Date('2026-03-01T00:00:00.000Z');

      expect(
        nextOccurrence(
          'FREQ=WEEKLY;COUNT=1',
          { startAt: null, dueAt: new Date('2026-03-02T12:00:00.000Z') },
          now,
        ),
      ).toBeNull();
    });
  });
});
