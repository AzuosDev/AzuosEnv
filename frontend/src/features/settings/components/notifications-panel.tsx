import { DevicePushCard } from './device-push-card';
import { NotificationsMatrix } from './notifications-matrix';

/** Aba de notificações: o que notifica (matriz) e onde recebe (dispositivo). */
export function NotificationsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <NotificationsMatrix />
      <DevicePushCard />
    </div>
  );
}
