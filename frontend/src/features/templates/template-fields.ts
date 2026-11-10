import type { TemplateTargetType, TemplateType } from '@/api/types';

export const TEMPLATE_TYPE_LABEL: Record<TemplateType, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
  task: 'Tarefa',
  checklist: 'Checklist',
  view: 'View',
};

/**
 * Onde cada tipo de template pode ser aplicado, como o backend exige: um Space
 * nasce na raiz do workspace, um Folder dentro de um Space, uma List dentro de
 * Space ou Folder, e tarefa, checklist e view dentro do que as carrega.
 */
export const TEMPLATE_TARGETS: Record<TemplateType, TemplateTargetType[]> = {
  space: [],
  folder: ['space'],
  list: ['space', 'folder'],
  task: ['list'],
  checklist: ['task'],
  view: ['space', 'folder', 'list'],
};

export const TARGET_LABEL: Record<TemplateTargetType, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
  task: 'Tarefa',
};

/** Frase do destino exigido, para o diálogo explicar antes de aplicar. */
export function targetHint(type: TemplateType): string {
  const targets = TEMPLATE_TARGETS[type];

  if (targets.length === 0) {
    return 'Este template cria um Space novo na raiz do workspace.';
  }

  return `Escolha o ${targets.map((target) => TARGET_LABEL[target]).join(' ou ')} de destino.`;
}
