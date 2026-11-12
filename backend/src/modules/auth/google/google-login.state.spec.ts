import { safeNextPath } from './google-login.state';

describe('safeNextPath', () => {
  it('keeps a relative path', () => {
    expect(safeNextPath('/w/123/tarefas?q=1')).toBe('/w/123/tarefas?q=1');
  });

  it('drops anything that leaves the app', () => {
    for (const value of [
      'https://evil.test',
      '//evil.test/x',
      '/x\\y',
      'tarefas',
      '',
      '   ',
      '/x://y',
      undefined,
      42,
    ]) {
      expect(safeNextPath(value)).toBeUndefined();
    }
  });

  it('drops a path that is too long', () => {
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBeUndefined();
  });
});
