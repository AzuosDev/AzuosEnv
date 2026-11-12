/** Fired on every write of an agent so the scheduler rebuilds its cron jobs. */
export const AI_AGENTS_CHANGED = 'ai-agents.changed';

export interface AiAgentsChangedEvent {
  workspaceId: string;
}
