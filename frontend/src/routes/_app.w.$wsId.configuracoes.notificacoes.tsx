import { createFileRoute } from '@tanstack/react-router';
import { notificationSettingsQuery } from '@/features/settings/api';
import { NotificationsPanel } from '@/features/settings/components/notifications-panel';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/notificacoes')({
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationSettingsQuery),
  component: NotificationsPanel,
  pendingComponent: PanelSkeleton,
});
