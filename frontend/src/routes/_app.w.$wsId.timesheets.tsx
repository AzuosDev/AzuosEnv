import { createFileRoute } from '@tanstack/react-router';
import { TimesheetsPage } from '@/features/timesheets/components/timesheets-page';

function Page() {
  const { wsId } = Route.useParams();

  return <TimesheetsPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/timesheets')({
  component: Page,
});
