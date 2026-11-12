/** Where a whiteboard lives; `workspace` is the hub, with no parent node. */
export const WHITEBOARD_LOCATION_TYPES = ['workspace', 'space', 'folder', 'list'] as const;
export type WhiteboardLocationType = (typeof WHITEBOARD_LOCATION_TYPES)[number];

/** Shapes the canvas draws: sticky notes, shapes, connectors, text and freehand. */
export const WHITEBOARD_ELEMENT_TYPES = ['note', 'shape', 'connector', 'text', 'drawing'] as const;
export type WhiteboardElementType = (typeof WHITEBOARD_ELEMENT_TYPES)[number];

/** Operations a batch PATCH may carry. */
export const WHITEBOARD_OPS = ['add', 'update', 'remove'] as const;
export type WhiteboardOpKind = (typeof WHITEBOARD_OPS)[number];

export const MAX_WHITEBOARD_ELEMENTS = 2000;

/** Operations accepted in a single batch. */
export const MAX_WHITEBOARD_OPS = 200;

export const MAX_ELEMENT_TEXT_LENGTH = 5000;

/** Coordinates of a freehand stroke (x, y pairs). */
export const MAX_DRAWING_POINTS = 4000;

/** Whiteboards read before the permission filter in memory. */
export const MAX_WHITEBOARD_SCAN = 500;

export const MAX_WHITEBOARD_TITLE_LENGTH = 200;
