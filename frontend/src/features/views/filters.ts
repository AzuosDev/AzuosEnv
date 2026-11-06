import type {
  FieldFilter,
  TaskFilters,
  TaskQueryParams,
  ViewConfig,
  ViewGroupBy,
} from '@/api/types';

/** Quantas tarefas cada lote da consulta traz. */
export const PAGE_SIZE = 50;

export interface QueryContext {
  /** List, Folder ou Space aberto. */
  location: NonNullable<TaskQueryParams['location']>;
  locationId: string;
  /** Busca da toolbar; vence o `q` guardado na view. */
  search?: string;
  groupBy: ViewGroupBy;
  /** Tamanho do lote; cada tipo de view pede o seu. */
  limit?: number;
}

function list(values: string[] | undefined): string[] | undefined {
  return values && values.length > 0 ? values : undefined;
}

/** Só os filtros de campo que já têm valor; isEmpty dispensa valor. */
export function usableFieldFilters(filters: FieldFilter[] | undefined): FieldFilter[] {
  return (filters ?? []).filter(
    (filter) => filter.op === 'isEmpty' || (filter.value !== undefined && filter.value !== ''),
  );
}

/** Remove o que está vazio para a query string não carregar parâmetro inútil. */
function clean(params: TaskQueryParams): TaskQueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as TaskQueryParams;
}

/** Troca ou tira o filtro de um campo personalizado na lista de filtros. */
export function setFieldFilter(
  filters: FieldFilter[] | undefined,
  filter: FieldFilter | null,
  fieldId: string,
): FieldFilter[] {
  const rest = (filters ?? []).filter((item) => item.fieldId !== fieldId);

  return filter ? [...rest, filter] : rest;
}

/**
 * Traduz a config da view (filtros, agrupamento e ordem) nos parâmetros de
 * GET /tasks/query. É a única ponte entre a toolbar e a API.
 */
export function toQueryParams(config: ViewConfig, context: QueryContext): TaskQueryParams {
  const filters: TaskFilters = config.filters ?? {};
  const search = context.search?.trim() ?? '';
  const usable = usableFieldFilters(filters.fieldFilters);

  return clean({
    location: context.location,
    locationId: context.locationId,
    groupBy: context.groupBy,
    sortBy: config.sortBy ?? 'position',
    limit: context.limit ?? PAGE_SIZE,
    statusIds: list(filters.statusIds),
    assigneeIds: list(filters.assigneeIds),
    priority: list(filters.priority) as TaskQueryParams['priority'],
    tagIds: list(filters.tagIds),
    me: filters.me === true ? true : undefined,
    dueFrom: filters.dueFrom,
    dueTo: filters.dueTo,
    fieldFilters: usable.length > 0 ? usable : undefined,
    includeSubtasks: config.showSubtasks === true ? true : undefined,
    includeClosed: config.showClosed === true ? true : undefined,
    q: search === '' ? filters.q : search,
  });
}

/** Quantos filtros estão ligados, para o selo do botão Filtrar. */
export function activeFilterCount(filters: TaskFilters | undefined): number {
  if (!filters) {
    return 0;
  }

  const groups = [filters.statusIds, filters.assigneeIds, filters.priority, filters.tagIds];
  const dates = [filters.dueFrom, filters.dueTo];

  return (
    groups.filter((group) => (group?.length ?? 0) > 0).length +
    dates.filter((date) => Boolean(date)).length +
    (filters.me === true ? 1 : 0) +
    usableFieldFilters(filters.fieldFilters).length
  );
}

/** Liga ou desliga um valor de um filtro de múltipla escolha. */
export function toggleValue<T extends string>(values: T[] | undefined, value: T): T[] {
  const current = values ?? [];

  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

/** Config sem nenhum filtro ligado; o resto (ordem, colunas) continua. */
export function clearFilters(config: ViewConfig): ViewConfig {
  const { q } = config.filters ?? {};

  return { ...config, filters: q === undefined ? {} : { q } };
}

/** Dia (yyyy-mm-dd) do input de data virando instante UTC do começo ou do fim. */
export function dayToIso(day: string, edge: 'start' | 'end'): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return undefined;
  }

  return new Date(`${day}T${edge === 'start' ? '00:00:00' : '23:59:59'}`).toISOString();
}

/** Volta do instante para o yyyy-mm-dd que o input de data mostra. */
export function isoToDay(iso: string | undefined): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${String(date.getFullYear())}-${month}-${day}`;
}
