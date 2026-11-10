/** Tipos de entidade que o app sabe abrir por link. */
export type LinkableKind = 'space' | 'folder' | 'list' | 'task' | 'doc';

/**
 * Destino de navegação do TanStack Router. A união é fechada para o roteador
 * conseguir casar cada `to` com os params dele.
 */
export type EntityLink =
  | { to: '/w/$wsId/s/$spaceId'; params: { wsId: string; spaceId: string } }
  | { to: '/w/$wsId/f/$folderId'; params: { wsId: string; folderId: string } }
  | { to: '/w/$wsId/l/$listId'; params: { wsId: string; listId: string } }
  | { to: '/w/$wsId/t/$customId'; params: { wsId: string; customId: string } };

/**
 * Para onde cada entidade abre. A tarefa vai pelo customId quando ele vem, e a
 * rota do painel também aceita o id. Doc ainda não tem tela: devolve null.
 */
export function entityLink(
  wsId: string,
  kind: LinkableKind,
  id: string,
  customId?: string,
): EntityLink | null {
  if (kind === 'space') {
    return { to: '/w/$wsId/s/$spaceId', params: { wsId, spaceId: id } };
  }

  if (kind === 'folder') {
    return { to: '/w/$wsId/f/$folderId', params: { wsId, folderId: id } };
  }

  if (kind === 'list') {
    return { to: '/w/$wsId/l/$listId', params: { wsId, listId: id } };
  }

  if (kind === 'task') {
    return { to: '/w/$wsId/t/$customId', params: { wsId, customId: customId ?? id } };
  }

  return null;
}
