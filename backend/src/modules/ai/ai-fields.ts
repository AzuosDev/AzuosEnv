/** Every feature that spends tokens; the usage row is keyed by it. */
export const AI_FEATURES = ['chat', 'summarize', 'tasksFromText', 'write', 'agent'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Entities the summarize endpoint accepts. */
export const AI_SUMMARIZE_ENTITY_TYPES = ['task', 'thread', 'channel', 'doc'] as const;
export type AiSummarizeEntityType = (typeof AI_SUMMARIZE_ENTITY_TYPES)[number];

/** Rewrites the assistant applies to a text the user typed. */
export const AI_WRITE_ACTIONS = ['improve', 'shorten', 'translate', 'fixGrammar'] as const;
export type AiWriteAction = (typeof AI_WRITE_ACTIONS)[number];

/** Scheduled agents of the workspace. */
export const AI_AGENT_TYPES = ['dailySummary', 'overdueDigest', 'bugTriage'] as const;
export type AiAgentType = (typeof AI_AGENT_TYPES)[number];

/** Tools the model may run on the server, always with the permissions of the user. */
export const AI_TOOL_NAMES = [
  'search_tasks',
  'get_task',
  'list_overdue',
  'summarize_list',
  'my_tasks',
] as const;
export type AiToolName = (typeof AI_TOOL_NAMES)[number];

export const MAX_AI_PROMPT_LENGTH = 4000;

/** Text accepted by summarize/tasks-from-text/write. */
export const MAX_AI_TEXT_LENGTH = 20_000;

export const MAX_AI_AGENT_NAME_LENGTH = 120;
export const MAX_CRON_LENGTH = 120;

/** Turns of the conversation replayed to the model (older ones are dropped). */
export const MAX_HISTORY_MESSAGES = 20;

/** Characters of a single message kept in the context window. */
export const MAX_CONTEXT_MESSAGE_CHARS = 4000;

/** Characters of the result of one tool call. */
export const MAX_TOOL_RESULT_CHARS = 6000;

/** Rounds of tool calling before the answer is forced. */
export const MAX_TOOL_ROUNDS = 3;

/** Items any tool returns in one call. */
export const MAX_TOOL_ITEMS = 20;

/** Entities read to build the context of the summarize endpoint. */
export const MAX_SUMMARY_ITEMS = 50;

/** Tasks one proposal of tasks-from-text may hold. */
export const MAX_PROPOSED_TASKS = 20;

/** Requests to the AI one user may fire per minute. */
export const AI_RATE_LIMIT = 20;
export const AI_RATE_WINDOW_MS = 60_000;

/** Timeout and attempts of every call to the provider. */
export const AI_REQUEST_TIMEOUT_MS = 60_000;
export const AI_REQUEST_ATTEMPTS = 2;

/** Tasks one agent run reads. */
export const MAX_AGENT_TASKS = 100;
