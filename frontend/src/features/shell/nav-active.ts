import type { TreeNodeKind } from './tree-path';

/** Primeiro segmento depois de /w/:wsId → módulo da navegação global. */
const SEGMENT_TO_NAV: Record<string, string> = {
  '': 'tarefas',
  s: 'tarefas',
  f: 'tarefas',
  l: 'tarefas',
  inbox: 'tarefas',
  'minhas-tarefas': 'tarefas',
  tudo: 'tarefas',
  arquivados: 'tarefas',
  lixeira: 'tarefas',
  planner: 'planner',
  chat: 'chat',
  docs: 'docs',
  dashboards: 'dashboards',
  metas: 'metas',
  timesheets: 'timesheets',
  automacoes: 'automacoes',
  whiteboards: 'whiteboards',
  ia: 'ia',
  configuracoes: 'configuracoes',
};

const SEGMENT_TO_KIND: Record<string, TreeNodeKind> = {
  s: 'space',
  f: 'folder',
  l: 'list',
};

/** Segmentos da rota dentro do workspace; vazio fora dele. */
function segments(pathname: string, wsId: string): string[] {
  const prefix = `/w/${wsId}`;

  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    return [];
  }

  return pathname.slice(prefix.length).split('/').filter(Boolean);
}

/** Item da navegação global que deve aparecer ativo. */
export function activeNavId(pathname: string, wsId: string): string | null {
  const parts = segments(pathname, wsId);

  if (pathname !== `/w/${wsId}` && parts.length === 0) {
    return null;
  }

  return SEGMENT_TO_NAV[parts[0] ?? ''] ?? null;
}

/** Space, Folder ou List aberto agora, para destacar o item da árvore. */
export function activeTreeTarget(
  pathname: string,
  wsId: string,
): { kind: TreeNodeKind; id: string } | null {
  const parts = segments(pathname, wsId);
  const kind = SEGMENT_TO_KIND[parts[0] ?? ''];
  const id = parts[1];

  return kind && id ? { kind, id } : null;
}
