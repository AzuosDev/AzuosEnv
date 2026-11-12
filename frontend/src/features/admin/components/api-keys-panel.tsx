import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KeyRound } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { ApiKey, ApiKeyScope } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { SettingsCard } from '@/features/settings/components/settings-card';
import { API_KEY_SCOPES, API_KEY_SCOPE_LABEL } from '../labels';
import { apiKeysQuery, createApiKey, revokeApiKey } from '../api';
import { SecretNotice } from './secret-notice';

function keyStatus(key: ApiKey): { label: string; tone: 'success' | 'neutral' | 'warning' } {
  if (key.revokedAt) {
    return { label: 'Revogada', tone: 'neutral' };
  }

  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
    return { label: 'Expirada', tone: 'warning' };
  }

  return { label: 'Ativa', tone: 'success' };
}

/** Chaves pessoais da API: criar (chave visível uma vez), escopos e revogar. */
export function ApiKeysPanel() {
  const queryClient = useQueryClient();
  const nameId = useId();
  const scopeId = useId();
  const expiresId = useId();
  const keys = useQuery(apiKeysQuery());
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('read');
  const [expiresAt, setExpiresAt] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });

  const create = useMutation({
    mutationFn: () =>
      createApiKey({
        name: name.trim(),
        scopes: scope === 'write' ? ['read', 'write'] : ['read'],
        ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString() } : {}),
      }),
    onSuccess: async (result) => {
      setName('');
      setExpiresAt('');
      setToken(result.token);
      await refresh();
      toast.success('Chave criada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const revoke = useMutation({
    mutationFn: (apiKeyId: string) => revokeApiKey(apiKeyId),
    onSuccess: async () => {
      setRevoking(null);
      await refresh();
      toast.success('Chave revogada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const items = keys.data ?? [];

  return (
    <>
      <SettingsCard
        title="Nova chave"
        description="A chave vale como a sua conta nas rotas da API. Ela aparece uma única vez."
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>Nome</Label>
            <Input
              id={nameId}
              placeholder="Integração do site"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor={scopeId}>Escopo</Label>
              <SelectNative
                id={scopeId}
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as ApiKeyScope);
                }}
              >
                {API_KEY_SCOPES.map((option) => (
                  <option key={option} value={option}>
                    {API_KEY_SCOPE_LABEL[option]}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor={expiresId}>Expira em (opcional)</Label>
              <Input
                id={expiresId}
                type="date"
                value={expiresAt}
                onChange={(event) => {
                  setExpiresAt(event.target.value);
                }}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="signal"
            className="self-start"
            disabled={name.trim().length === 0 || create.isPending}
          >
            Criar chave
          </Button>

          {token ? (
            <SecretNotice
              label="Sua chave"
              value={token}
              warning="Guarde agora: só o hash fica no servidor e ela não aparece de novo."
            />
          ) : null}
        </form>
      </SettingsCard>

      <SettingsCard title="Suas chaves" description="Revogar é imediato e não se desfaz.">
        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma chave"
            description="Crie uma chave para integrar outro sistema com a API."
            icon={<KeyRound className="h-7 w-7" aria-hidden="true" />}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line" aria-label="Chaves de API">
            {items.map((key) => {
              const status = keyStatus(key);

              return (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{key.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {key.hint}… ·{' '}
                      {key.scopes.includes('write') ? 'leitura e escrita' : 'só leitura'}
                      {key.lastUsedAt
                        ? ` · usada ${format(new Date(key.lastUsedAt), "d 'de' MMM", {
                            locale: ptBR,
                          })}`
                        : ' · nunca usada'}
                      {key.expiresAt
                        ? ` · expira ${format(new Date(key.expiresAt), "d 'de' MMM yyyy", {
                            locale: ptBR,
                          })}`
                        : ''}
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    {key.revokedAt ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Revogar ${key.name}`}
                        onClick={() => {
                          setRevoking(key);
                        }}
                      >
                        Revogar
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      <ConfirmDialog
        open={revoking !== null}
        title="Revogar chave"
        description={`"${revoking?.name ?? ''}" deixa de funcionar na hora.`}
        confirmLabel="Revogar"
        danger
        pending={revoke.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null);
          }
        }}
        onConfirm={() => {
          if (revoking) {
            revoke.mutate(revoking.id);
          }
        }}
      />
    </>
  );
}
