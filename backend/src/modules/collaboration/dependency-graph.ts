import { DependencyType } from './collaboration-fields';

/** Directed edge "blocker -> blocked"; `linked` rows do not produce one. */
export interface DependencyEdge {
  from: string;
  to: string;
}

/** `waiting_on` points from the blocker to the blocked task. */
export function dependencyEdge(
  taskId: string,
  dependsOnId: string,
  type: DependencyType,
): DependencyEdge | null {
  if (type === 'waiting_on') {
    return { from: dependsOnId, to: taskId };
  }

  if (type === 'blocking') {
    return { from: taskId, to: dependsOnId };
  }

  return null;
}

/** True when the new edge closes a loop over the edges that already exist. */
export function createsCycle(existing: DependencyEdge[], edge: DependencyEdge): boolean {
  if (edge.from === edge.to) {
    return true;
  }

  const outgoing = new Map<string, string[]>();

  for (const item of existing) {
    outgoing.set(item.from, [...(outgoing.get(item.from) ?? []), item.to]);
  }

  const pending = [edge.to];
  const seen = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop() as string;

    if (current === edge.from) {
      return true;
    }

    if (seen.has(current)) {
      continue;
    }

    seen.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }

  return false;
}
