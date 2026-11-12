import { GithubOutcome } from './github-fields';

/** The parts of a `pull_request` payload this integration reads. */
export interface PullRequestInfo {
  repository: string;
  action: string;
  merged: boolean;
  number: number | null;
  title: string;
  branch: string;
  url: string | null;
  author: string | null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Reads the payload of GitHub; null when it is not a pull request we handle. */
export function readPullRequest(body: Record<string, unknown>): PullRequestInfo | null {
  const pullRequest = asObject(body.pull_request);
  const repository = asText(asObject(body.repository).full_name).toLowerCase();

  if (repository.length === 0 || Object.keys(pullRequest).length === 0) {
    return null;
  }

  const head = asObject(pullRequest.head);
  const user = asObject(pullRequest.user);
  const number = pullRequest.number;

  return {
    repository,
    action: asText(body.action),
    merged: pullRequest.merged === true,
    number: typeof number === 'number' ? number : null,
    title: asText(pullRequest.title),
    branch: asText(head.ref),
    url: asText(pullRequest.html_url) || null,
    author: asText(user.login) || null,
  };
}

/** Opening a PR asks for review; merging it ships. */
export function outcomeOf(info: PullRequestInfo): GithubOutcome | null {
  if (info.action === 'closed' && info.merged) {
    return 'deploy';
  }

  if (['opened', 'reopened', 'ready_for_review'].includes(info.action)) {
    return 'review';
  }

  return null;
}

/**
 * Visible id of the task cited in the title or in the branch, as `PREFIXO-n`. The
 * prefix of the workspace is what makes the match, so a random `AB-1` is ignored.
 */
export function taskRefOf(info: PullRequestInfo, taskPrefix: string): string | null {
  const prefix = taskPrefix.trim();

  if (prefix.length === 0) {
    return null;
  }

  const pattern = new RegExp(`(?:^|[^A-Za-z0-9])(${escapeRegExp(prefix)})-(\\d+)`, 'i');

  for (const text of [info.title, info.branch]) {
    const match = pattern.exec(text);

    if (match) {
      return `${prefix.toUpperCase()}-${match[2]}`;
    }
  }

  return null;
}

/** Comment left on the task when the PR shows up. */
export function pullRequestComment(info: PullRequestInfo, outcome: GithubOutcome): string {
  const label = info.number ? `PR #${info.number}` : 'PR';
  const author = info.author ? ` por ${info.author}` : '';
  const link = info.url ? `: ${info.url}` : '';

  return outcome === 'deploy'
    ? `${label} mesclado${author}${link}`
    : `${label} aberto${author}${link}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
