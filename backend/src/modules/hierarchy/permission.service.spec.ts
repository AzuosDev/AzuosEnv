import { Types } from 'mongoose';
import { WorkspaceRole } from '../workspaces/workspace-roles';
import { hasLevelAtLeast, maxLevel } from './permission-levels';
import {
  ExplicitLevels,
  PermissionContext,
  PermissionService,
  ResourceRef,
  permissionKey,
} from './permission.service';

describe('permission levels', () => {
  it('ranks the levels', () => {
    expect(hasLevelAtLeast('full', 'edit')).toBe(true);
    expect(hasLevelAtLeast('comment', 'edit')).toBe(false);
    expect(hasLevelAtLeast(null, 'view')).toBe(false);
    expect(maxLevel('view', 'edit')).toBe('edit');
    expect(maxLevel(null, 'comment')).toBe('comment');
  });
});

describe('PermissionService.levelFromChain', () => {
  const spaceId = new Types.ObjectId();
  const listId = new Types.ObjectId();
  const service = new PermissionService(null as never, null as never);

  const context = (role: WorkspaceRole): PermissionContext => ({
    workspaceId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    role,
  });

  const chain = (isPrivate: boolean): ResourceRef[] => [
    { resourceType: 'space', resourceId: spaceId, private: isPrivate },
    { resourceType: 'list', resourceId: listId },
  ];

  const levels = (entries: [string, 'view' | 'comment' | 'edit' | 'full'][]): ExplicitLevels =>
    new Map(entries);

  it('gives full access to admins and the owner', () => {
    expect(service.levelFromChain(context('owner'), chain(true), levels([]))).toBe('full');
    expect(service.levelFromChain(context('admin'), chain(true), levels([]))).toBe('full');
  });

  it('gives a member full access while nothing in the chain is private', () => {
    expect(service.levelFromChain(context('member'), chain(false), levels([]))).toBe('full');
    expect(service.levelFromChain(context('member'), chain(true), levels([]))).toBeNull();
  });

  it('inherits the level shared on an ancestor', () => {
    const shared = levels([[permissionKey('space', spaceId), 'comment']]);

    expect(service.levelFromChain(context('guest'), chain(true), shared)).toBe('comment');
    expect(service.levelFromChain(context('limited'), chain(false), shared)).toBe('comment');
  });

  it('keeps the highest level of the chain', () => {
    const shared = levels([
      [permissionKey('space', spaceId), 'view'],
      [permissionKey('list', listId), 'edit'],
    ]);

    expect(service.levelFromChain(context('guest'), chain(true), shared)).toBe('edit');
  });

  it('leaves guests without explicit permission out', () => {
    expect(service.levelFromChain(context('guest'), chain(false), levels([]))).toBeNull();
    expect(service.levelFromChain(context('limited'), chain(false), levels([]))).toBeNull();
  });
});
