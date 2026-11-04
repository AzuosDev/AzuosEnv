/** Entities the sidebar can pin or list as recently opened. */
export const FAVORITE_ENTITY_TYPES = ['space', 'folder', 'list', 'task', 'doc'] as const;
export type FavoriteEntityType = (typeof FAVORITE_ENTITY_TYPES)[number];

/** Entities opened as a page, the only ones that feed the recents. */
export const RECENT_ENTITY_TYPES = ['task', 'list', 'doc'] as const;
export type RecentEntityType = (typeof RECENT_ENTITY_TYPES)[number];

/** Rows kept per user and workspace; the endpoint returns the newest ones. */
export const MAX_RECENT_ITEMS = 20;
