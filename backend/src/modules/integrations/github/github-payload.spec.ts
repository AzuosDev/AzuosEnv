import { outcomeOf, pullRequestComment, readPullRequest, taskRefOf } from './github-payload';

const payload = (
  overrides: Record<string, unknown> = {},
  pullRequest: Record<string, unknown> = {},
): Record<string, unknown> => ({
  action: 'opened',
  repository: { full_name: 'AzuosDev/uSolutionsPDV' },
  ...overrides,
  pull_request: {
    number: 42,
    title: 'AZD-142 ajusta o fechamento de caixa',
    html_url: 'https://github.com/azuosdev/usolutionspdv/pull/42',
    merged: false,
    head: { ref: 'feature/azd-142-caixa' },
    user: { login: 'felipe' },
    ...pullRequest,
  },
});

describe('github-payload', () => {
  describe('readPullRequest', () => {
    it('reads the repository in lowercase and the branch of the head', () => {
      const info = readPullRequest(payload());

      expect(info).toMatchObject({
        repository: 'azuosdev/usolutionspdv',
        action: 'opened',
        number: 42,
        branch: 'feature/azd-142-caixa',
        author: 'felipe',
        merged: false,
      });
    });

    it('answers null when the event is not about a pull request', () => {
      expect(readPullRequest({ action: 'created', repository: { full_name: 'a/b' } })).toBeNull();
      expect(readPullRequest({ pull_request: { number: 1 } })).toBeNull();
    });
  });

  describe('outcomeOf', () => {
    it('maps an opened pull request to review', () => {
      expect(outcomeOf(readPullRequest(payload())!)).toBe('review');
      expect(outcomeOf(readPullRequest(payload({ action: 'reopened' }))!)).toBe('review');
    });

    it('maps a merged pull request to deploy', () => {
      const info = readPullRequest(payload({ action: 'closed' }, { merged: true }));

      expect(outcomeOf(info!)).toBe('deploy');
    });

    it('ignores a closed pull request that was not merged', () => {
      expect(outcomeOf(readPullRequest(payload({ action: 'closed' }))!)).toBeNull();
      expect(outcomeOf(readPullRequest(payload({ action: 'synchronize' }))!)).toBeNull();
    });
  });

  describe('taskRefOf', () => {
    it('finds the visible id in the title, whatever the case', () => {
      expect(taskRefOf(readPullRequest(payload())!, 'AZD')).toBe('AZD-142');
    });

    it('falls back to the branch', () => {
      const info = readPullRequest(payload({}, { title: 'ajusta o caixa' }));

      expect(taskRefOf(info!, 'azd')).toBe('AZD-142');
    });

    it('ignores a reference of another prefix', () => {
      expect(taskRefOf(readPullRequest(payload())!, 'XPT')).toBeNull();
    });

    it('does not match the prefix in the middle of a word', () => {
      const info = readPullRequest(
        payload({}, { title: 'BAZD-9 nao conta', head: { ref: 'main' } }),
      );

      expect(taskRefOf(info!, 'AZD')).toBeNull();
    });
  });

  it('comments with the number, the author and the link', () => {
    const info = readPullRequest(payload())!;

    expect(pullRequestComment(info, 'review')).toBe(
      'PR #42 aberto por felipe: https://github.com/azuosdev/usolutionspdv/pull/42',
    );
    expect(pullRequestComment(info, 'deploy')).toContain('mesclado');
  });
});
