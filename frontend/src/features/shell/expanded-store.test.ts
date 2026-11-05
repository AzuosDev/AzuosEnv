import { beforeEach, describe, expect, it } from 'vitest';
import { readExpanded, toggleId, withIds, writeExpanded } from './expanded-store';

describe('expanded-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('grava e lê por workspace', () => {
    writeExpanded('ws1', ['sp1', 'fo1']);
    writeExpanded('ws2', ['sp9']);

    expect(readExpanded('ws1')).toEqual(['sp1', 'fo1']);
    expect(readExpanded('ws2')).toEqual(['sp9']);
    expect(readExpanded('ws3')).toEqual([]);
  });

  it('conteúdo inválido não quebra a leitura', () => {
    window.localStorage.setItem('azuos-env:tree:ws1', '{isso nao e json');
    expect(readExpanded('ws1')).toEqual([]);

    window.localStorage.setItem('azuos-env:tree:ws1', '{"a":1}');
    expect(readExpanded('ws1')).toEqual([]);

    window.localStorage.setItem('azuos-env:tree:ws1', '["sp1",2,null]');
    expect(readExpanded('ws1')).toEqual(['sp1']);
  });

  it('toggleId liga e desliga sem repetir', () => {
    expect(toggleId([], 'sp1')).toEqual(['sp1']);
    expect(toggleId(['sp1'], 'sp1')).toEqual([]);
    expect(toggleId(['sp1'], 'fo1')).toEqual(['sp1', 'fo1']);
  });

  it('withIds só acrescenta o que falta e preserva a referência quando nada muda', () => {
    const current = ['sp1'];

    expect(withIds(current, ['sp1'])).toBe(current);
    expect(withIds(current, ['sp1', 'fo1'])).toEqual(['sp1', 'fo1']);
  });
});
