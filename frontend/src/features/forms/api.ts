import { queryOptions } from '@tanstack/react-query';
import { api, API_BASE_URL } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateFormBody,
  CreateFormInput,
  FormResult,
  PublicForm,
  SubmitFormResult,
  UpdateFormBody,
  UpdateFormInput,
  WorkspaceForm,
} from '@/api/types';

/** Formulários de uma List; uma List não tem tantos assim. */
const PAGE_SIZE = 50;

export function formsQuery(wsId: string, listId: string) {
  return queryOptions({
    queryKey: [...queryKeys.forms(wsId), listId] as const,
    queryFn: async (): Promise<WorkspaceForm[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/forms', {
          params: { path: { wsId }, query: { listId, limit: PAGE_SIZE } },
        }),
      ).items as WorkspaceForm[],
    staleTime: 30_000,
  });
}

export function formQuery(wsId: string, formId: string) {
  return queryOptions({
    queryKey: queryKeys.form(wsId, formId),
    queryFn: async (): Promise<WorkspaceForm> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/forms/{formId}', {
          params: { path: { wsId, formId } },
        }),
      ) as WorkspaceForm,
    staleTime: 15_000,
  });
}

export async function createForm(wsId: string, body: CreateFormInput): Promise<FormResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/forms', {
      params: { path: { wsId } },
      body: body as unknown as CreateFormBody,
    }),
  ) as FormResult;
}

export async function updateForm(
  wsId: string,
  formId: string,
  body: UpdateFormInput,
): Promise<WorkspaceForm> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/forms/{formId}', {
      params: { path: { wsId, formId } },
      body: body as unknown as UpdateFormBody,
    }),
  ) as WorkspaceForm;
}

export async function deleteForm(wsId: string, formId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/forms/{formId}', {
      params: { path: { wsId, formId } },
    }),
  );
}

/** A tela pública não tem sessão: vai por fetch cru, sem o cliente autenticado. */
export function publicFormQuery(token: string) {
  return queryOptions({
    queryKey: queryKeys.publicForm(token),
    queryFn: async (): Promise<PublicForm> => {
      const response = await fetch(`${API_BASE_URL}/api/v1/public/forms/${token}`);

      if (!response.ok) {
        throw new ApiRequestError({
          statusCode: response.status,
          code: 'FORM_NOT_FOUND',
          message: 'Formulário não encontrado ou fora do ar.',
        });
      }

      return (await response.json()) as PublicForm;
    },
    retry: false,
    staleTime: 60_000,
  });
}

/** Envio público: `website` é o honeypot e precisa chegar vazio. */
export async function submitPublicForm(
  token: string,
  body: { values: Record<string, unknown>; website?: string },
): Promise<SubmitFormResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/forms/${token}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload as { code?: string; message?: string } | null;

    throw new ApiRequestError({
      statusCode: response.status,
      code: error?.code ?? 'FORM_SUBMISSION_FAILED',
      message: error?.message ?? 'Não foi possível enviar o formulário.',
    });
  }

  return payload as SubmitFormResult;
}
