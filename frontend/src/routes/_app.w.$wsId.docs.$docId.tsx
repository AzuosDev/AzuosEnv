import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { DocEditor } from '@/features/docs/components/doc-editor';

const search = z.object({ page: z.string().optional() });

function Page() {
  const { wsId, docId } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <DocEditor
      wsId={wsId}
      docId={docId}
      {...(page !== undefined ? { pageId: page } : {})}
      onPickPage={(pageId) => {
        void navigate({
          to: '/w/$wsId/docs/$docId',
          params: { wsId, docId },
          search: { page: pageId },
        });
      }}
    />
  );
}

export const Route = createFileRoute('/_app/w/$wsId/docs/$docId')({
  validateSearch: search,
  component: Page,
});
