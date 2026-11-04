export const SEARCH_TYPES = ['task', 'list', 'space', 'folder', 'comment', 'page', 'user'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** Results returned per type. */
export const MAX_SEARCH_RESULTS = 20;

/** Documents read before the permission filter, per type and per query shape. */
export const MAX_SEARCH_SCAN = 200;

export const MAX_SEARCH_TERM_LENGTH = 200;
