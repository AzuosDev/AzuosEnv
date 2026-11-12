import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Chain of automations that led to the event being handled right now. It travels
 * with the async context of the actions, so an automation that reacts to what
 * another one wrote knows how deep it already is and which automations are in the
 * chain. That is what cuts loops between two automations.
 */
export interface AutomationRunContext {
  depth: number;
  automationIds: string[];
}

const storage = new AsyncLocalStorage<AutomationRunContext>();

/** Must be read before the first `await` of an event handler. */
export function currentAutomationRun(): AutomationRunContext | null {
  return storage.getStore() ?? null;
}

export function runInAutomationContext<T>(context: AutomationRunContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function childContext(
  parent: AutomationRunContext | null,
  automationId: string,
): AutomationRunContext {
  return {
    depth: (parent?.depth ?? 0) + 1,
    automationIds: [...(parent?.automationIds ?? []), automationId],
  };
}
