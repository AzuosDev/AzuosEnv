import { taskPrefixFromName } from './workspaces.service';

describe('taskPrefixFromName', () => {
  it('uses the first letters of the name', () => {
    expect(taskPrefixFromName('Azuos Dev')).toBe('AZU');
    expect(taskPrefixFromName('Operações')).toBe('OPE');
  });

  it('falls back when the name has no usable letters', () => {
    expect(taskPrefixFromName('123456')).toBe('WS');
    expect(taskPrefixFromName('#')).toBe('WOR');
  });
});
