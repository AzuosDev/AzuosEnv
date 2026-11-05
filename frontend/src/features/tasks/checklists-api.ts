import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import type {
  Checklist,
  CreateChecklistItemInput,
  ReorderInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput,
} from '@/api/types';

/**
 * Checklists da tarefa. Toda escrita devolve a checklist inteira, então o
 * painel troca o documento no cache do detalhe sem pedir a lista de novo.
 */
export async function createChecklist(
  wsId: string,
  idOrCustomId: string,
  name: string,
): Promise<Checklist> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/checklists', {
      params: { path: { wsId, idOrCustomId } },
      body: { name },
    }),
  ) as Checklist;
}

export async function updateChecklist(
  wsId: string,
  checklistId: string,
  body: UpdateChecklistInput,
): Promise<Checklist> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/checklists/{checklistId}', {
      params: { path: { wsId, checklistId } },
      body,
    }),
  ) as Checklist;
}

export async function deleteChecklist(wsId: string, checklistId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/checklists/{checklistId}', {
      params: { path: { wsId, checklistId } },
    }),
  );
}

export async function reorderChecklist(
  wsId: string,
  checklistId: string,
  body: ReorderInput,
): Promise<Checklist> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/checklists/{checklistId}/reorder', {
      params: { path: { wsId, checklistId } },
      body,
    }),
  ) as Checklist;
}

export async function addChecklistItem(
  wsId: string,
  checklistId: string,
  body: CreateChecklistItemInput,
): Promise<Checklist> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/checklists/{checklistId}/items', {
      params: { path: { wsId, checklistId } },
      body,
    }),
  ) as Checklist;
}

export async function updateChecklistItem(
  wsId: string,
  checklistId: string,
  itemId: string,
  body: UpdateChecklistItemInput,
): Promise<Checklist> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/checklists/{checklistId}/items/{itemId}', {
      params: { path: { wsId, checklistId, itemId } },
      body,
    }),
  ) as Checklist;
}

export async function deleteChecklistItem(
  wsId: string,
  checklistId: string,
  itemId: string,
): Promise<Checklist> {
  return unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/checklists/{checklistId}/items/{itemId}', {
      params: { path: { wsId, checklistId, itemId } },
    }),
  ) as Checklist;
}

export async function reorderChecklistItem(
  wsId: string,
  checklistId: string,
  itemId: string,
  body: ReorderInput,
): Promise<Checklist> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/checklists/{checklistId}/items/{itemId}/reorder', {
      params: { path: { wsId, checklistId, itemId } },
      body,
    }),
  ) as Checklist;
}
