import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  TimeEntry,
  Timesheet,
  TimesheetApproval,
  TimesheetReviewResult,
  TimesheetSubmitResult,
} from '@/api/types';
import { weekRangeIso } from './week';

/** Lançamentos lidos de uma vez na semana; uma pessoa não passa disso. */
const WEEK_ENTRY_LIMIT = 100;
const WEEK_ENTRY_PAGES = 5;

/** Grade tarefa × dia da semana. Sem userId vale a própria pessoa. */
export function timesheetQuery(wsId: string, weekStart: string, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.timesheet(wsId, userId ?? 'me', weekStart),
    queryFn: async (): Promise<Timesheet> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/timesheets', {
          params: { path: { wsId }, query: { weekStart, ...(userId ? { userId } : {}) } },
        }),
      ),
    staleTime: 15_000,
  });
}

/**
 * Lançamentos fechados da semana, que é o que a grade precisa para editar
 * célula por célula (a grade da API só traz os minutos somados).
 */
export function weekEntriesQuery(wsId: string, weekStart: string, userId?: string) {
  const { from, to } = weekRangeIso(weekStart);

  return queryOptions({
    queryKey: queryKeys.weekEntries(wsId, userId ?? 'me', weekStart),
    queryFn: async (): Promise<TimeEntry[]> => {
      const items: TimeEntry[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < WEEK_ENTRY_PAGES; page += 1) {
        const result = unwrap(
          await api.GET('/api/v1/workspaces/{wsId}/time/entries', {
            params: {
              path: { wsId },
              query: {
                from,
                to,
                limit: WEEK_ENTRY_LIMIT,
                ...(userId ? { userId } : {}),
                ...(cursor ? { cursor } : {}),
              },
            },
          }),
        );

        items.push(...(result.items as TimeEntry[]));

        if (!result.nextCursor) {
          break;
        }

        cursor = result.nextCursor;
      }

      return items;
    },
    staleTime: 15_000,
  });
}

export async function submitTimesheet(
  wsId: string,
  weekStart: string,
): Promise<TimesheetSubmitResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/timesheets/submit', {
      params: { path: { wsId } },
      body: { weekStart },
    }),
  );
}

/** Semanas enviadas aguardando aprovação; exige papel admin. */
export function approvalsQuery(wsId: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.timesheetApprovals(wsId),
    queryFn: async (): Promise<TimesheetApproval[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/timesheets/approvals', {
          params: { path: { wsId } },
        }),
      ).items,
    enabled,
    staleTime: 15_000,
  });
}

export async function reviewTimesheet(
  wsId: string,
  decision: 'approve' | 'reject',
  body: { userId: string; weekStart: string },
): Promise<TimesheetReviewResult> {
  const path = { path: { wsId } };

  return unwrap(
    decision === 'approve'
      ? await api.POST('/api/v1/workspaces/{wsId}/timesheets/approve', { params: path, body })
      : await api.POST('/api/v1/workspaces/{wsId}/timesheets/reject', { params: path, body }),
  );
}

/** CSV da semana já autenticado; a rota de export não abre por URL direta. */
export async function exportTimesheetCsv(
  wsId: string,
  weekStart: string,
  userId?: string,
): Promise<Blob> {
  const { data, response } = await api.GET('/api/v1/workspaces/{wsId}/timesheets/export', {
    params: { path: { wsId }, query: { weekStart, ...(userId ? { userId } : {}) } },
    parseAs: 'blob',
  });
  const blob = data as unknown;

  if (!response.ok || !(blob instanceof Blob)) {
    throw new ApiRequestError({
      statusCode: response.status,
      code: 'EXPORT_FAILED',
      message: 'Não foi possível exportar a semana.',
    });
  }

  return blob;
}

/** Salva o arquivo no computador a partir do blob já autenticado. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
