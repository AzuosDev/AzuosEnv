import { describe, expect, it } from 'vitest';
import { activeNavId, activeTreeTarget } from './nav-active';

const WS = '507f1f77bcf86cd799439011';

describe('activeNavId', () => {
  it('a home e os locais da hierarquia ficam em Tarefas', () => {
    expect(activeNavId(`/w/${WS}`, WS)).toBe('tarefas');
    expect(activeNavId(`/w/${WS}/s/abc`, WS)).toBe('tarefas');
    expect(activeNavId(`/w/${WS}/l/abc`, WS)).toBe('tarefas');
    expect(activeNavId(`/w/${WS}/inbox`, WS)).toBe('tarefas');
  });

  it('cada módulo acende o próprio item', () => {
    expect(activeNavId(`/w/${WS}/planner`, WS)).toBe('planner');
    expect(activeNavId(`/w/${WS}/automacoes`, WS)).toBe('automacoes');
  });

  it('as abas da configuração acendem Configurações', () => {
    expect(activeNavId(`/w/${WS}/configuracoes`, WS)).toBe('configuracoes');
    expect(activeNavId(`/w/${WS}/configuracoes/perfil`, WS)).toBe('configuracoes');
    expect(activeNavId(`/w/${WS}/configuracoes/pessoas`, WS)).toBe('configuracoes');
  });

  it('fora do workspace ou em rota desconhecida ninguém acende', () => {
    expect(activeNavId('/workspaces', WS)).toBeNull();
    expect(activeNavId(`/w/${WS}/qualquer-coisa`, WS)).toBeNull();
    expect(activeNavId('/w/outro/planner', WS)).toBeNull();
  });
});

describe('activeTreeTarget', () => {
  it('reconhece Space, Folder e List', () => {
    expect(activeTreeTarget(`/w/${WS}/s/sp1`, WS)).toEqual({ kind: 'space', id: 'sp1' });
    expect(activeTreeTarget(`/w/${WS}/f/fo1`, WS)).toEqual({ kind: 'folder', id: 'fo1' });
    expect(activeTreeTarget(`/w/${WS}/l/li1`, WS)).toEqual({ kind: 'list', id: 'li1' });
  });

  it('sem local aberto devolve null', () => {
    expect(activeTreeTarget(`/w/${WS}`, WS)).toBeNull();
    expect(activeTreeTarget(`/w/${WS}/planner`, WS)).toBeNull();
    expect(activeTreeTarget(`/w/${WS}/s`, WS)).toBeNull();
  });
});
