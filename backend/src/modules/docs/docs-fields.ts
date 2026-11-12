/** Where a Doc lives; `workspace` is the hub of the workspace, with no parent node. */
export const DOC_LOCATION_TYPES = ['workspace', 'space', 'folder', 'list'] as const;
export type DocLocationType = (typeof DOC_LOCATION_TYPES)[number];

/** Tabs of the Docs hub. */
export const DOC_HUB_TABS = ['recent', 'favorites', 'mine', 'all'] as const;
export type DocHubTab = (typeof DOC_HUB_TABS)[number];

/** Deepest page nesting inside a Doc (a page and its children). */
export const MAX_PAGE_DEPTH = 5;

/** A page keeps at most one snapshot per window. */
export const PAGE_VERSION_INTERVAL_MS = 5 * 60 * 1000;

/** Snapshots kept per page; the oldest ones are dropped. */
export const MAX_PAGE_VERSIONS = 50;

/** Documents read before the permission filter in memory. */
export const MAX_DOC_SCAN = 500;

/** Pages returned by the tree of a Doc. */
export const MAX_DOC_PAGES = 500;

export const MAX_DOC_TITLE_LENGTH = 200;

export const MAX_PAGE_TEXT_LENGTH = 200_000;

/** Bytes of the opaque token of a public share. */
export const SHARE_TOKEN_BYTES = 32;
