import { describe, expect, it } from 'vitest';
import {
  capacityTone,
  formatMetricValue,
  personDropId,
  shiftWorkloadAnchor,
  userIdOfDropId,
  workloadRange,
} from './workload-model';

const TODAY = new Date('2026-11-18T12:00:00');

describe('capacityTone', () => {
  it('vazio, abaixo, no limite e acima', () => {
    expect(capacityTone(0, 3)).toBe('empty');
    expect(capacityTone(2, 3)).toBe('free');
    expect(capacityTone(3, 3)).toBe('limit');
    expect(capacityTone(4, 3)).toBe('over');
  });

  it('sem capacidade declarada qualquer carga é acima', () => {
    expect(capacityTone(1, 0)).toBe('over');
    expect(capacityTone(0, 0)).toBe('empty');
  });
});

describe('formatMetricValue', () => {
  it('zero não aparece, horas viram duração e o resto vira número pt-BR', () => {
    expect(formatMetricValue(0, 'tasks')).toBe('');
    expect(formatMetricValue(3, 'tasks')).toBe('3');
    expect(formatMetricValue(1.5, 'hours')).toBe('1h 30min');
    expect(formatMetricValue(2.5, 'points')).toBe('2,5');
  });
});

describe('workloadRange', () => {
  it('começa na segunda da semana do dia âncora', () => {
    const range = workloadRange('2026-11-18', 7, TODAY);

    expect(range.from).toBe('2026-11-16');
    expect(range.to).toBe('2026-11-22');
    expect(range.days).toHaveLength(7);
    expect(range.days.find((day) => day.isToday)?.key).toBe('2026-11-18');
    expect(range.days[6]?.isWeekend).toBe(true);
  });

  it('o recorte de 14 dias anda de duas em duas semanas', () => {
    expect(workloadRange('2026-11-18', 14, TODAY).days).toHaveLength(14);
    expect(shiftWorkloadAnchor('2026-11-18', 14, 1)).toBe('2026-12-02');
    expect(shiftWorkloadAnchor('2026-11-18', 7, -1)).toBe('2026-11-11');
  });
});

describe('dropId da pessoa', () => {
  it('ida e volta', () => {
    expect(userIdOfDropId(personDropId('u1'))).toBe('u1');
    expect(userIdOfDropId('day:2026-11-18')).toBeNull();
  });
});
