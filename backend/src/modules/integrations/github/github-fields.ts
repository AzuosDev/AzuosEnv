/** What the webhook did with the pull request. */
export const GITHUB_OUTCOMES = ['review', 'deploy'] as const;
export type GithubOutcome = (typeof GITHUB_OUTCOMES)[number];

/** Status the task moves to when the PR opens; matched by name in the status set. */
export const DEFAULT_REVIEW_STATUS = 'Code review';

/** Status the task moves to when the PR is merged. */
export const DEFAULT_DEPLOY_STATUS = 'Deploy';

/** Bytes of the webhook secret when the server generates it. */
export const GITHUB_SECRET_BYTES = 24;

/** Header GitHub signs the body with. */
export const GITHUB_SIGNATURE_HEADER = 'x-hub-signature-256';
export const GITHUB_EVENT_HEADER = 'x-github-event';

export const MAX_REPOSITORY_LENGTH = 140;
