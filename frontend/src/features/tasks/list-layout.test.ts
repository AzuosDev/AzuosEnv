import { describe, expect, it } from 'vitest';
import type { CustomField } from '@/api/types';
import { listLayout } from './list-layout';

function field(id: string): CustomField {
  return { id, name: `Campo ${id}`, type: 'text' } as CustomField;
}

const fields = [field('f1'), field('f2'), field('f3')];

describe('listLayout', () => {
  it('recolhe a grade quando o container é estreito', () => {
    const layout = listLayout(480, fields);

    expect(layout.wide).toBe(false);
    expect(layout.fields).toEqual([]);
    expect(layout.style).toEqual({});
  });

  it('abre as colunas fixas assim que o nome cabe', () => {
    const layout = listLayout(640, fields);

    expect(layout.wide).toBe(true);
    expect(layout.fields).toEqual([]);
    expect(layout.style.gridTemplateColumns).toBe(
      '28px minmax(0,1fr)  minmax(0,132px) minmax(0,96px) minmax(0,112px)',
    );
  });

  it('mostra só os campos que cabem na largura', () => {
    expect(listLayout(760, fields).fields.map((item) => item.id)).toEqual(['f1']);
    expect(listLayout(1000, fields).fields.map((item) => item.id)).toEqual(['f1', 'f2', 'f3']);
  });

  it('não inventa coluna quando a view não escolheu nenhum campo', () => {
    expect(listLayout(1400, []).fields).toEqual([]);
  });

  it('põe uma faixa por campo escolhido', () => {
    expect(listLayout(1400, fields).style.gridTemplateColumns).toBe(
      '28px minmax(0,1fr) minmax(0,112px) minmax(0,112px) minmax(0,112px) minmax(0,132px) minmax(0,96px) minmax(0,112px)',
    );
  });
});
