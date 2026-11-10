import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  AppliedTemplate,
  ApplyTemplateInput,
  CreateTemplateInput,
  Template,
  TemplateType,
} from '@/api/types';

/** Templates do workspace, mais novos primeiro. */
export function templatesQuery(wsId: string, type?: TemplateType) {
  return queryOptions({
    queryKey: queryKeys.templates(wsId, type ?? 'all'),
    queryFn: async (): Promise<Template[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/templates', {
          params: { path: { wsId }, query: { limit: 100, ...(type ? { type } : {}) } },
        }),
      ).items as Template[],
    staleTime: 30_000,
  });
}

export async function createTemplate(wsId: string, body: CreateTemplateInput): Promise<Template> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/templates', { params: { path: { wsId } }, body }),
  ) as Template;
}

export async function applyTemplate(
  wsId: string,
  templateId: string,
  body: ApplyTemplateInput,
): Promise<AppliedTemplate> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/templates/{templateId}/apply', {
      params: { path: { wsId, templateId } },
      body,
    }),
  );
}

export async function deleteTemplate(wsId: string, templateId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/templates/{templateId}', {
      params: { path: { wsId, templateId } },
    }),
  );
}
