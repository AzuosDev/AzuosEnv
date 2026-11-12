import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { GoogleLogo } from '@/features/auth/components/google-logo';
import { useSession } from '@/features/auth/session';
import { disconnectGoogle } from '../api';
import { ConfirmDialog } from './confirm-dialog';
import { SettingsCard, SettingsRow } from './settings-card';

/**
 * Contas de outros serviços ligadas a esta conta. O desvínculo só aparece com
 * senha definida: sem ela, o Google é a única forma de entrar.
 */
export function ConnectedAccounts() {
  const user = useSession();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const connected = user?.authProviders.includes('google') ?? false;
  const hasPassword = user?.authProviders.includes('password') ?? false;

  const disconnect = useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: async () => {
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Conta do Google desconectada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <SettingsCard
      title="Contas conectadas"
      description="Serviços que podem abrir a sua sessão no Azuos Env."
    >
      <SettingsRow
        last
        title={
          <span className="flex flex-wrap items-center gap-2">
            <GoogleLogo className="h-4 w-4" />
            Google
            {connected ? (
              <StatusPill tone="success">Conectada</StatusPill>
            ) : (
              <StatusPill>Não conectada</StatusPill>
            )}
          </span>
        }
        description={
          connected
            ? hasPassword
              ? 'Você pode entrar com o Google ou com a sua senha.'
              : 'Hoje o Google é a única forma de entrar. Defina uma senha para poder desconectar.'
            : 'Entre pelo botão "Continuar com Google" na tela de login para conectar.'
        }
        control={
          connected && hasPassword ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={disconnect.isPending}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Desconectar Google
            </Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Desconectar o Google?"
        description="Você continua entrando com e-mail e senha. Para voltar a usar o Google, entre de novo pelo botão na tela de login."
        confirmLabel="Desconectar"
        pending={disconnect.isPending}
        danger
        onConfirm={() => {
          disconnect.mutate();
        }}
      />
    </SettingsCard>
  );
}
