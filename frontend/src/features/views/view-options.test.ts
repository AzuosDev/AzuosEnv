import { describe, expect, it } from 'vitest';
import { viewNumberOption, viewOption, withViewOption } from './view-options';

describe('viewOption', () => {
  it('lê o valor guardado quando ele é um dos aceitos', () => {
    const config = withViewOption({}, 'calendarMode', 'week');

    expect(viewOption(config, 'calendarMode', ['month', 'week'], 'month')).toBe('week');
  });

  it('cai no padrão quando falta, não é texto ou não é aceito', () => {
    expect(viewOption({}, 'calendarMode', ['month', 'week'], 'month')).toBe('month');
    const numeric = withViewOption({}, 'calendarMode', 7);
    const unknownValue = withViewOption({}, 'calendarMode', 'ano');

    expect(viewOption(numeric, 'calendarMode', ['month', 'week'], 'month')).toBe('month');
    expect(viewOption(unknownValue, 'calendarMode', ['month', 'week'], 'month')).toBe('month');
  });

  it('número só vale se estiver na lista', () => {
    expect(viewNumberOption(withViewOption({}, 'span', 14), 'span', [7, 14], 7)).toBe(14);
    expect(viewNumberOption(withViewOption({}, 'span', 30), 'span', [7, 14], 7)).toBe(7);
  });

  it('withViewOption não apaga as outras opções nem o resto da config', () => {
    const config = withViewOption(withViewOption({ groupBy: 'none' }, 'a', 1), 'b', 2);

    expect(config.groupBy).toBe('none');
    expect(config.options).toEqual({ a: 1, b: 2 });
  });
});
