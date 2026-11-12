import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { canAdmin } from '@/features/settings/roles';
import { workspaceQuery } from '@/features/settings/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { exportTimesheetCsv, saveBlob } from '../api';
import { currentWeekStart } from '../week';
import { ApprovalsTab } from './approvals-tab';
import { MyHoursTab } from './my-hours-tab';
import { TeamTab } from './team-tab';
import { WeekNav } from './week-nav';

type TimesheetTab = 'mine' | 'team' | 'approvals';

const TAB_LABEL: Record<TimesheetTab, string> = {
  mine: 'Minhas horas',
  team: 'Equipe',
  approvals: 'Aprovações',
};

/** Timesheets: minhas horas, equipe e aprovações, sempre de uma semana. */
export function TimesheetsPage({ wsId }: { wsId: string }) {
  const workspace = useQuery(workspaceQuery(wsId));
  const [weekStart, setWeekStart] = useState(() => currentWeekStart());
  const [tab, setTab] = useState<TimesheetTab>('mine');
  const [exporting, setExporting] = useState(false);
  const admin = workspace.data ? canAdmin(workspace.data.role) : false;
  const tabs: TimesheetTab[] = admin ? ['mine', 'team', 'approvals'] : ['mine'];

  const onExport = (): void => {
    setExporting(true);
    void exportTimesheetCsv(wsId, weekStart)
      .then((blob) => {
        saveBlob(blob, `timesheet-${weekStart}.csv`);
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setExporting(false);
      });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title="Timesheets"
        description="As horas da semana por tarefa, com faturável, envio e aprovação."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WeekNav weekStart={weekStart} onChange={setWeekStart} />
            <Button variant="ghost" size="sm" disabled={exporting} onClick={onExport}>
              {exporting ? (
                <Spinner label="Exportando" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Exportar CSV
            </Button>
          </div>
        }
      />

      <div className="min-w-0 px-4 md:px-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as TimesheetTab);
          }}
          className="flex min-w-0 flex-col"
        >
          <TabsList className="min-w-0 overflow-x-auto">
            {tabs.map((value) => (
              <TabsTrigger key={value} value={value} className="shrink-0">
                {TAB_LABEL[value]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="mine">
            {tab === 'mine' ? <MyHoursTab wsId={wsId} weekStart={weekStart} /> : null}
          </TabsContent>
          {admin ? (
            <TabsContent value="team">
              {tab === 'team' ? <TeamTab wsId={wsId} weekStart={weekStart} /> : null}
            </TabsContent>
          ) : null}
          {admin ? (
            <TabsContent value="approvals">
              {tab === 'approvals' ? <ApprovalsTab wsId={wsId} /> : null}
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}
