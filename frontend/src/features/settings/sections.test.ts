import { describe, expect, it } from 'vitest';
import {
  activeSettings,
  groupedSections,
  SETTINGS_SECTIONS,
  sectionLabel,
  sectionTarget,
  visibleSections,
} from './sections';
import { canAdmin, isOwner } from './roles';

const WS = '507f1f77bcf86cd799439011';

describe('visibleSections', () => {
  it('mostra as seis seções para owner e admin', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(visibleSections(role).map((section) => section.id)).toEqual([
        'conta',
        'notificacoes',
        'workspace',
        'pessoas',
        'integracoes',
        'dados',
      ]);
    }
  });

  it('para member sobram as seções pessoais e Pessoas só com Equipes', () => {
    for (const role of ['member', 'limited', 'guest'] as const) {
      const sections = visibleSections(role);

      expect(sections.map((section) => section.id)).toEqual(['conta', 'notificacoes', 'pessoas']);
      expect(sections[0]?.tabs.map((tab) => tab.id)).toEqual([
        'perfil',
        'preferencias',
        'seguranca',
      ]);
      expect(sections[2]?.tabs.map((tab) => tab.id)).toEqual(['equipes']);
    }
  });

  it('cada tela antiga continua sendo uma aba, sem id repetido', () => {
    const ids = SETTINGS_SECTIONS.flatMap((section) => section.tabs.map((tab) => tab.id));

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'perfil',
      'preferencias',
      'seguranca',
      'notificacoes',
      'workspace',
      'recursos',
      'campos',
      'pessoas',
      'equipes',
      'integracoes',
      'webhooks',
      'chaves',
      'dados',
      'auditoria',
    ]);
  });
});

describe('sectionLabel', () => {
  it('seção com uma aba só fala pelo nome da aba', () => {
    const admin = visibleSections('admin').find((section) => section.id === 'pessoas')!;
    const member = visibleSections('member').find((section) => section.id === 'pessoas')!;

    expect(sectionLabel(admin)).toBe('Pessoas');
    expect(sectionLabel(member)).toBe('Equipes');
  });
});

describe('sectionTarget', () => {
  it('leva para a primeira aba visível do papel', () => {
    const admin = visibleSections('admin').find((section) => section.id === 'pessoas')!;
    const member = visibleSections('member').find((section) => section.id === 'pessoas')!;

    expect(sectionTarget(admin)).toBe('/w/$wsId/configuracoes/pessoas');
    expect(sectionTarget(member)).toBe('/w/$wsId/configuracoes/equipes');
  });
});

describe('groupedSections', () => {
  it('mantém os três grupos para admin', () => {
    expect(groupedSections('admin').map((entry) => entry.group)).toEqual([
      'pessoal',
      'workspace',
      'avancado',
    ]);
  });

  it('para member sobra o grupo do workspace só com Pessoas e nada em Avançado', () => {
    const groups = groupedSections('member');

    expect(groups.map((entry) => entry.group)).toEqual(['pessoal', 'workspace']);
    expect(groups[1]?.items.map((section) => section.id)).toEqual(['pessoas']);
  });
});

describe('activeSettings', () => {
  it('resolve a seção e a aba pelo caminho', () => {
    const active = activeSettings(`/w/${WS}/configuracoes/campos`, WS, 'admin');

    expect(active?.section.id).toBe('workspace');
    expect(active?.tab.label).toBe('Campos personalizados');
  });

  it('devolve null na própria Configurações, fora dela e em aba sem permissão', () => {
    expect(activeSettings(`/w/${WS}/configuracoes`, WS, 'admin')).toBeNull();
    expect(activeSettings(`/w/${WS}/configuracoes/nao-existe`, WS, 'admin')).toBeNull();
    expect(activeSettings(`/w/${WS}/planner`, WS, 'admin')).toBeNull();
    expect(activeSettings('/w/outro/configuracoes/perfil', WS, 'admin')).toBeNull();
    expect(activeSettings(`/w/${WS}/configuracoes/auditoria`, WS, 'member')).toBeNull();
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
