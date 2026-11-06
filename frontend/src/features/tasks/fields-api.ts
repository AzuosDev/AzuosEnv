import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateCustomFieldInput,
  CustomField,
  CustomFieldScope,
  UpdateCustomFieldInput,
} from '@/api/types';

/** Campos do escopo e os herdados de cima, na ordem de herança. */
export function customFieldsQuery(wsId: string, scope: CustomFieldScope, scopeId: string) {
  return queryOptions({
    queryKey: queryKeys.customFields(wsId, scope, scopeId),
    queryFn: async (): Promise<CustomField[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/custom-fields', {
          params: { path: { wsId }, query: { scope, scopeId } },
        }),
      ) as CustomField[],
    staleTime: 60_000,
  });
}

export async function createCustomField(
  wsId: string,
  body: CreateCustomFieldInput,
): Promise<CustomField> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/custom-fields', {
      params: { path: { wsId } },
      body,
    }),
  ) as CustomField;
}

export async function updateCustomField(
  wsId: string,
  fieldId: string,
  body: UpdateCustomFieldInput,
): Promise<CustomField> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/custom-fields/{fieldId}', {
      params: { path: { wsId, fieldId } },
      body,
    }),
  ) as CustomField;
}

export async function deleteCustomField(wsId: string, fieldId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/custom-fields/{fieldId}', {
      params: { path: { wsId, fieldId } },
    }),
  );
}
