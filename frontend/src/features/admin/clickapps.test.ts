import { describe, expect, it } from 'vitest';
import type { ClickApps } from '@/api/types';
import { CLICK_APP_KEYS, effectiveClickApp, overrideCount, toggleOverride } from './clickapps';

const workspace: ClickApps = {
  priority: true,
  tags: true,
  timeTracking: true,
  estimates: true,
  sprints: false,
  customFields: true,
  multipleLists: true,
  customIds: true,
  ai: false,
};

describe('effectiveClickApp', () => {
  it('cai no workspace quando o Space não decidiu', () => {
    expect(effectiveClickApp('sprints', workspace, undefined)).toBe(false);
    expect(effectiveClickApp('priority', workspace, {})).toBe(true);
  });

  it('o override do Space vence o workspace nos dois sentidos', () => {
    expect(effectiveClickApp('sprints', workspace, { sprints: true })).toBe(true);
    expect(effectiveClickApp('priority', workspace, { priority: false })).toBe(false);
  });
});

describe('toggleOverride', () => {
  it('grava a decisão do Space', () => {
    expect(toggleOverride(undefined, 'ai', true)).toEqual({ ai: true });
    expect(toggleOverride({ ai: true }, 'ai', false)).toEqual({ ai: false });
  });

  it('herdar apaga a chave em vez de gravar o valor do workspace', () => {
    expect(toggleOverride({ ai: true, sprints: false }, 'ai', 'inherit')).toEqual({
      sprints: false,
    });
  });
});

describe('overrideCount', () => {
  it('conta só o que o Space decidiu', () => {
    expect(overrideCount(undefined)).toBe(0);
    expect(overrideCount({ ai: true, sprints: false })).toBe(2);
  });

  it('todas as chaves do workspace têm rótulo', () => {
    expect(CLICK_APP_KEYS).toHaveLength(Object.keys(workspace).length);
  });
});
