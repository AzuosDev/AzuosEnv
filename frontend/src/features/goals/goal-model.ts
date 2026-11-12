import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Goal, GoalFolder, GoalTarget, GoalView, TargetType } from '@/api/types';

export const TARGET_TYPES: TargetType[] = ['number', 'boolean', 'currency', 'tasks'];

export const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  number: 'Número',
  boolean: 'Sim/Não',
  currency: 'Moeda',
  tasks: 'Tarefas',
};

/** Alvo de tarefas é mantido pelos eventos de domínio: o valor não se digita. */
export function isManualTarget(target: Pick<GoalTarget, 'type'>): boolean {
  return target.type !== 'tasks';
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Mesma conta do backend: sim/não é tudo ou nada e os outros medem o caminho de
 * `start` até `target`. A tela precisa dela para pintar o valor na hora, antes
 * de a resposta voltar.
 */
export function targetPercent(
  target: Pick<GoalTarget, 'type' | 'start' | 'target' | 'current'>,
): number {
  if (target.type === 'boolean') {
    return target.current >= (target.target || 1) ? 100 : 0;
  }

  const span = target.target - target.start;

  if (span === 0) {
    return target.current >= target.target ? 100 : 0;
  }

  return round(Math.min(1, Math.max(0, (target.current - target.start) / span)) * 100);
}

/** Progresso da meta: média simples do progresso dos alvos. */
export function goalPercent(
  targets: Pick<GoalTarget, 'type' | 'start' | 'target' | 'current'>[],
): number {
  if (targets.length === 0) {
    return 0;
  }

  return round(targets.reduce((sum, target) => sum + targetPercent(target), 0) / targets.length);
}

/** Tom do progresso: longe, a caminho, perto e cumprido. */
export function progressTone(percent: number): 'danger' | 'warning' | 'accent' | 'success' {
  if (percent >= 100) {
    return 'success';
  }

  if (percent >= 60) {
    return 'accent';
  }

  if (percent >= 25) {
    return 'warning';
  }

  return 'danger';
}

export function percentLabel(percent: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(percent)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

/** "12 de 20 horas", "R$ 1.500,00 de R$ 10.000,00", "3 de 8 tarefas", "Feito". */
export function formatTargetValue(target: GoalTarget): string {
  if (target.type === 'boolean') {
    return targetPercent(target) === 100 ? 'Feito' : 'Pendente';
  }

  if (target.type === 'currency') {
    return `${formatBrl(target.current)} de ${formatBrl(target.target)}`;
  }

  const unit = target.type === 'tasks' ? 'tarefas' : (target.unit ?? '');

  return `${formatNumber(target.current)} de ${formatNumber(target.target)}${
    unit === '' ? '' : ` ${unit}`
  }`.trim();
}

/** Passo do +/−: um décimo do caminho, nunca menor que um. */
export function stepOf(target: Pick<GoalTarget, 'type' | 'start' | 'target'>): number {
  if (target.type === 'currency') {
    return Math.max(1, Math.round(Math.abs(target.target - target.start) / 10));
  }

  return Math.max(1, Math.round(Math.abs(target.target - target.start) / 10));
}

/** Valor seguinte do alvo, preso entre o começo e o alvo. */
export function nextValue(target: GoalTarget, delta: number): number {
  const low = Math.min(target.start, target.target);
  const high = Math.max(target.start, target.target);

  return Math.min(high, Math.max(low, round(target.current + delta)));
}

/** O autor e os donos são quem muda a meta, como o backend exige. */
export function canWriteGoal(goal: Pick<Goal, 'createdBy' | 'ownerIds'>, userId: string): boolean {
  return goal.createdBy === userId || goal.ownerIds.includes(userId);
}

export interface GoalGroup {
  /** null é o grupo das metas fora de pasta. */
  folder: GoalFolder | null;
  goals: GoalView[];
}

/** Metas por pasta, na ordem das pastas, com "Sem pasta" no fim. */
export function groupGoals(goals: GoalView[], folders: GoalFolder[]): GoalGroup[] {
  const groups: GoalGroup[] = folders.map((folder) => ({
    folder,
    goals: goals.filter((item) => item.goal.folderId === folder.id),
  }));
  const loose = goals.filter((item) => !item.goal.folderId);

  if (loose.length > 0) {
    groups.push({ folder: null, goals: loose });
  }

  return groups.filter((group) => group.goals.length > 0 || group.folder !== null);
}

export function goalDueLabel(goal: Pick<Goal, 'dueDate'>): string | null {
  return goal.dueDate
    ? format(new Date(goal.dueDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;
}

/** Dia em yyyy-MM-dd para o input type=date do formulário. */
export function dueInputValue(goal: Pick<Goal, 'dueDate'> | null): string {
  return goal?.dueDate ? format(new Date(goal.dueDate), 'yyyy-MM-dd') : '';
}

/** Meio-dia local, para o fuso não empurrar o prazo para o dia anterior. */
export function dueFromInput(value: string): string | null {
  return value === '' ? null : new Date(`${value}T12:00:00`).toISOString();
}
