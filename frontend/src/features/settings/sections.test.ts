import { describe, expect, it } from 'vitest';
import { activeSection, groupedSections, visibleSections } from './sections';
import { canAdmin, isOwner } from './roles';

const WS = '507f1f77bcf86cd799439011';

describe('visibleSections', () => {
  it('mostra tudo para owner e admin', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(visibleSections(role).map((section) => section.id)).toEqual([
        'perfil',
        'preferencias',
        'notificacoes',
        'seguranca',
        'workspace',
        'pessoas',
        'equipes',
      ]);
    }
  });

  it('esconde Workspace e Pessoas de member, limited e guest', () => {
    for (const role of ['member', 'limited', 'guest'] as const) {
      const ids = visibleSections(role).map((section) => section.id);

      expect(ids).not.toContain('workspace');
      expect(ids).not.toContain('pessoas');
      expect(ids).toContain('equipes');
      expect(ids).toContain('perfil');
    }
  });
});

describe('groupedSections', () => {
  it('mantém os dois grupos para admin', () => {
    expect(groupedSections('admin').map((entry) => entry.group)).toEqual(['pessoal', 'workspace']);
  });

  it('para member sobra o grupo do workspace só com Equipes', () => {
    const groups = groupedSections('member');

    expect(groups.map((entry) => entry.group)).toEqual(['pessoal', 'workspace']);
    expect(groups[1]?.items.map((section) => section.id)).toEqual(['equipes']);
  });
});

describe('activeSection', () => {
  it('resolve a seção pelo caminho', () => {
    expect(activeSection(`/w/${WS}/configuracoes/pessoas`, WS)?.id).toBe('pessoas');
  });

  it('devolve null na própria Configurações e fora dela', () => {
    expect(activeSection(`/w/${WS}/configuracoes`, WS)).toBeNull();
    expect(activeSection(`/w/${WS}/configuracoes/nao-existe`, WS)).toBeNull();
    expect(activeSection(`/w/${WS}/planner`, WS)).toBeNull();
    expect(activeSection('/w/outro/configuracoes/perfil', WS)).toBeNull();
  });
});

describe('papéis', () => {
  it('canAdmin vale para owner e admin', () => {
    expect(['owner', 'admin'].map((role) => canAdmin(role as 'owner'))).toEqual([true, true]);
    expect(['member', 'limited', 'guest'].map((role) => canAdmin(role as 'member'))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('isOwner vale só para owner', () => {
    expect(isOwner('owner')).toBe(true);
    expect(isOwner('admin')).toBe(false);
  });
});
