import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { Timesheet } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/field';
import { membersQuery } from '@/features/settings/api';
import { cn } from '@/lib/utils';
import { timesheetQuery } from '../api';
import { APPROVAL_LABEL, formatCellHours } from '../timesheet-model';
import { dayLabel, isWeekend, weekDayKeys } from '../week';
import { MyHoursTab } from './my-hours-tab';

export interface TeamTabProps {
  wsId: string;
  weekStart: string;
}

/** Horas de cada pessoa do workspace na semana; abrir mostra a grade dela. */
export function TeamTab({ wsId, weekStart }: TeamTabProps) {
  const members = useQuery(membersQuery(wsId));
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const days = weekDayKeys(weekStart);
  const people = (members.data ?? []).filter((member) => member.status === 'active');
  const sheets = useQueries({
    queries: people.map((member) => timesheetQuery(wsId, weekStart, member.userId.id)),
  });

  if (members.isPending) {
    return <Skeleton className="h-40" />;
  }

  if (members.isError) {
    return <FormAlert>{errorMessage(members.error)}</FormAlert>;
  }

  const failed = sheets.find((result) => result.isError);

  if (failed?.error) {
    return <FormAlert>{errorMessage(failed.error)}</FormAlert>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <caption className="sr-only">Horas da equipe na semana</caption>
          <thead>
            <tr className="bg-surface-2 text-left">
              <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
                Pessoa
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className={cn(
                    'px-1 py-2.5 text-center text-[12px] font-semibold',
                    'text-muted',
                    isWeekend(day) ? 'bg-surface-2/60' : '',
                  )}
                >
                  {dayLabel(day)}
                </th>
              ))}
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-[12px] font-semibold text-muted"
              >
                Total
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-[12px] font-semibold text-muted"
              >
                Faturável
              </th>
              <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((member, index) => {
              const sheet = sheets[index]?.data as Timesheet | undefined;

              return (
                <tr key={member.userId.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink">
                    <Button
                      variant="nav"
                      size="sm"
                      className="h-auto min-h-11 px-0 font-medium text-ink"
                      onClick={() => {
                        setOpenUserId((current) =>
                          current === member.userId.id ? null : member.userId.id,
                        );
                      }}
                    >
                      {member.userId.name}
                    </Button>
                  </th>
                  {days.map((day) => (
                    <td key={day} className="px-1 py-2.5 text-center text-body">
                      {formatCellHours(sheet?.totals.byDay[day] ?? 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-semibold text-ink">
                    {formatCellHours(sheet?.totals.total ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-body">
                    {formatCellHours(sheet?.totals.billableMinutes ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-muted">
                    {sheet ? APPROVAL_LABEL[sheet.approvalStatus] : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openUserId ? (
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="heading text-lg">
            {people.find((member) => member.userId.id === openUserId)?.userId.name ?? 'Pessoa'}
          </h2>
          <MyHoursTab wsId={wsId} weekStart={weekStart} userId={openUserId} readOnly />
        </section>
      ) : null}
    </div>
  );
}
