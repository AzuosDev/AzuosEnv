import type { SearchResult, SearchResults, SearchType } from '@/api/types';
import { entityLink, type EntityLink } from '@/lib/entity-links';

/** Ordem em que os grupos aparecem na palette. */
export const SEARCH_TYPE_ORDER: SearchType[] = [
  'task',
  'list',
  'folder',
  'space',
  'comment',
  'page',
  'message',
  'user',
];

export const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
  task: 'Tarefas',
  list: 'Lists',
  folder: 'Folders',
  space: 'Spaces',
  comment: 'Comentários',
  page: 'Páginas',
  message: 'Mensagens',
  user: 'Pessoas',
};

/** Tipos que já têm tela; os outros aparecem sem link até o módulo chegar. */
export const NAVIGABLE_TYPES: SearchType[] = [
  'task',
  'list',
  'folder',
  'space',
  'comment',
  'message',
];

export interface SearchRow {
  type: SearchType;
  id: string;
  /** Texto principal do item. */
  title: string;
  /** Texto de apoio: id da tarefa, trecho do comentário, e-mail da pessoa. */
  hint: string;
  /** Rota que o item abre; null quando o módulo ainda não tem tela. */
  target: EntityLink | null;
}

function textOf(hit: Record<string, unknown>, key: string): string {
  const value = hit[key];

  return typeof value === 'string' ? value : '';
}

/** Um resultado da API virado em linha da palette. */
function toRow(wsId: string, type: SearchType, hit: Record<string, unknown>): SearchRow {
  const id = textOf(hit, 'id');
  const name = textOf(hit, 'name');

  if (type === 'task') {
    const customId = textOf(hit, 'customId');

    return {
      type,
      id,
      title: name,
      hint: customId,
      target: entityLink(wsId, 'task', id, customId),
    };
  }

  if (type === 'list' || type === 'folder' || type === 'space') {
    return {
      type,
      id,
      title: name,
      hint: SEARCH_TYPE_LABEL[type].replace(/s$/, ''),
      target: entityLink(wsId, type, id),
    };
  }

  if (type === 'comment') {
    const customId = textOf(hit, 'customId');

    return {
      type,
      id,
      title: name,
      hint: customId,
      target: entityLink(wsId, 'task', textOf(hit, 'taskId'), customId),
    };
  }

  if (type === 'message') {
    return {
      type,
      id,
      title: name,
      hint: 'Mensagem do chat',
      target: entityLink(wsId, 'channel', textOf(hit, 'channelId')),
    };
  }

  if (type === 'user') {
    return { type, id, title: name, hint: textOf(hit, 'email'), target: null };
  }

  return { type, id, title: name, hint: SEARCH_TYPE_LABEL[type], target: null };
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  rows: SearchRow[];
}

/** Grupos na ordem fixa, só com os tipos que trouxeram resultado. */
export function searchGroups(wsId: string, result: SearchResult | undefined): SearchGroup[] {
  const results = (result?.results ?? {}) as SearchResults;

  return SEARCH_TYPE_ORDER.map((type) => {
    const hits = (results[type] ?? []) as unknown as Record<string, unknown>[];

    return {
      type,
      label: SEARCH_TYPE_LABEL[type],
      rows: hits.map((hit) => toRow(wsId, type, hit)),
    };
  }).filter((group) => group.rows.length > 0);
}

/** Quantos resultados a busca trouxe, somando os grupos. */
export function countResults(groups: SearchGroup[]): number {
  return groups.reduce((total, group) => total + group.rows.length, 0);
}
