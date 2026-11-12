import type { DependencyType, StatusGroup, TaskDependency } from '@/api/types';

/** Os três blocos da seção, do ponto de vista da tarefa aberta. */
export type DependencyGroupKey = 'waiting' | 'blocking' | 'linked';

export const DEPENDENCY_GROUP_ORDER: DependencyGroupKey[] = ['waiting', 'blocking', 'linked'];

export const DEPENDENCY_GROUP_LABEL: Record<DependencyGroupKey, string> = {
  waiting: 'Aguardando',
  blocking: 'Bloqueando',
  linked: 'Vinculada',
};

export const DEPENDENCY_GROUP_HINT: Record<DependencyGroupKey, string> = {
  waiting: 'Esta tarefa só anda quando as de baixo terminarem.',
  blocking: 'Estas tarefas esperam por esta.',
  linked: 'Relação sem bloqueio, só para contexto.',
};

/** Tipo gravado na API quando a dependência nasce em cada bloco. */
export const DEPENDENCY_GROUP_TYPE: Record<DependencyGroupKey, DependencyType> = {
  waiting: 'waiting_on',
  blocking: 'blocking',
  linked: 'linked',
};

export interface DependencyRef {
  dependency: TaskDependency;
  /** A outra ponta da relação, qualquer que seja o sentido da linha. */
  otherTaskId: string;
}

export type DependencyGroups = Record<DependencyGroupKey, DependencyRef[]>;

/**
 * Separa as linhas nos três blocos. A API devolve os dois sentidos, então uma
 * linha "A bloqueia T" entra em Aguardando de T, e "A aguarda T" entra em
 * Bloqueando de T.
 */
export function groupDependencies(rows: TaskDependency[], taskId: string): DependencyGroups {
  const groups: DependencyGroups = { waiting: [], blocking: [], linked: [] };

  for (const dependency of rows) {
    const owns = String(dependency.taskId) === taskId;
    const otherTaskId = owns ? String(dependency.dependsOnId) : String(dependency.taskId);
    const ref: DependencyRef = { dependency, otherTaskId };

    if (dependency.type === 'linked') {
      groups.linked.push(ref);

      continue;
    }

    const waiting = dependency.type === 'waiting_on' ? owns : !owns;

    groups[waiting ? 'waiting' : 'blocking'].push(ref);
  }

  return groups;
}

/** Ids das tarefas do outro lado, sem repetir, para buscar nome e status. */
export function dependencyTaskIds(groups: DependencyGroups): string[] {
  const ids = DEPENDENCY_GROUP_ORDER.flatMap((key) => groups[key].map((ref) => ref.otherTaskId));

  return [...new Set(ids)];
}

/** Status que já não bloqueiam ninguém. */
export function isSettled(group: StatusGroup | undefined): boolean {
  return group === 'done' || group === 'closed';
}

/**
 * A tarefa está bloqueada quando alguma das que ela aguarda não terminou. Um
 * status desconhecido (sem acesso à tarefa) conta como pendente.
 */
export function blockingRefs(
  groups: DependencyGroups,
  statusOf: (taskId: string) => StatusGroup | undefined,
): DependencyRef[] {
  return groups.waiting.filter((ref) => !isSettled(statusOf(ref.otherTaskId)));
}
