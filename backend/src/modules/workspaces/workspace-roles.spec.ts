import { WORKSPACE_ROLES, hasRoleAtLeast, isRoleAbove, roleRank } from './workspace-roles';

describe('workspace roles', () => {
  it('ranks roles from owner to guest', () => {
    const ranks = WORKSPACE_ROLES.map(roleRank);

    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  it('accepts a role at or above the requirement', () => {
    expect(hasRoleAtLeast('owner', 'admin')).toBe(true);
    expect(hasRoleAtLeast('admin', 'admin')).toBe(true);
    expect(hasRoleAtLeast('member', 'admin')).toBe(false);
    expect(hasRoleAtLeast('guest', 'guest')).toBe(true);
  });

  it('compares roles strictly', () => {
    expect(isRoleAbove('admin', 'member')).toBe(true);
    expect(isRoleAbove('member', 'member')).toBe(false);
  });
});
