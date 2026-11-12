import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GitBranch } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { GithubIntegration } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { SettingsCard } from '@/features/settings/components/settings-card';
import {
  createGithubIntegration,
  deleteGithubIntegration,
  githubIntegrationsQuery,
  updateGithubIntegration,
} from '../api';
import { SecretNotice } from './secret-notice';

/** Mesmos padrões do backend (github-fields.ts). */
const DEFAULT_REVIEW_STATUS = 'Code review';
const DEFAULT_DEPLOY_STATUS = 'Deploy';

function lastEvent(value: string | null): string {
  return value
    ? `última entrega ${format(new Date(value), "d 'de' MMM', às' HH:mm", { locale: ptBR })}`
    : 'nenhuma entrega ainda';
}

/** Repositórios ligados, a URL do webhook e o secret de cada um. */
export function GithubCard({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const repositoryId = useId();
  const reviewId = useId();
  const deployId = useId();
  const integrations = useQuery(githubIntegrationsQuery(wsId));
  const [repository, setRepository] = useState('');
  const [reviewStatusName, setReviewStatusName] = useState(DEFAULT_REVIEW_STATUS);
  const [deployStatusName, setDeployStatusName] = useState(DEFAULT_DEPLOY_STATUS);
  const [secret, setSecret] = useState<string | null>(null);
  const [removing, setRemoving] = useState<GithubIntegration | null>(null);

  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.githubIntegrations(wsId) });

  const connect = useMutation({
    mutationFn: () =>
      createGithubIntegration(wsId, {
        repository: repository.trim(),
        reviewStatusName: reviewStatusName.trim() || DEFAULT_REVIEW_STATUS,
        deployStatusName: deployStatusName.trim() || DEFAULT_DEPLOY_STATUS,
      }),
    onSuccess: async (result) => {
      setRepository('');
      setSecret(result.secret);
      await refresh();
      toast.success('Repositório ligado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const update = useMutation({
    mutationFn: (input: { id: string; active?: boolean; rotateSecret?: boolean }) =>
      updateGithubIntegration(wsId, input.id, {
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.rotateSecret ? { rotateSecret: true } : {}),
      }),
    onSuccess: async (result) => {
      if (result.secret) {
        setSecret(result.secret);
      }

      await refresh();
      toast.success('Integração atualizada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (integrationId: string) => deleteGithubIntegration(wsId, integrationId),
    onSuccess: async () => {
      setRemoving(null);
      await refresh();
      toast.success('Repositório desligado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const items = integrations.data?.items ?? [];

  return (
    <>
      <SettingsCard
        title="GitHub"
        description="O repositório avisa o Azuos Env a cada push, PR e deploy."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="github-webhook-url">URL do webhook</Label>
            <Input
              id="github-webhook-url"
              readOnly
              value={integrations.data?.webhookUrl ?? ''}
              onFocus={(event) => {
                event.currentTarget.select();
              }}
            />
            <p className="text-[12.5px] text-muted">
              Cole em Settings → Webhooks do repositório, com content type application/json.
            </p>
          </div>

          {secret ? (
            <SecretNotice
              label="Secret do webhook"
              value={secret}
              warning="Guarde agora: o servidor não mostra de novo."
            />
          ) : null}

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              connect.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={repositoryId}>Repositório</Label>
              <Input
                id={repositoryId}
                placeholder="azuosdev/usolutions-pdv"
                value={repository}
                onChange={(event) => {
                  setRepository(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor={reviewId}>Status ao abrir o PR</Label>
                <Input
                  id={reviewId}
                  value={reviewStatusName}
                  onChange={(event) => {
                    setReviewStatusName(event.target.value);
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor={deployId}>Status ao fazer deploy</Label>
                <Input
                  id={deployId}
                  value={deployStatusName}
                  onChange={(event) => {
                    setDeployStatusName(event.target.value);
                  }}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="self-start"
              disabled={repository.trim().length < 3 || connect.isPending}
            >
              Ligar repositório
            </Button>
          </form>

          {items.length === 0 ? (
            <EmptyState
              title="Nenhum repositório ligado"
              description="Ligue um repositório para ver review e deploy nas tarefas."
              icon={<GitBranch className="h-7 w-7" aria-hidden="true" />}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{item.repository}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {lastEvent(item.lastEventAt)} · review em {item.reviewStatusName} · deploy em{' '}
                      {item.deployStatusName}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={item.active ? 'success' : 'neutral'}>
                      {item.active ? 'Ativo' : 'Pausado'}
                    </StatusPill>
                    <Switch
                      aria-label={`Ativar ${item.repository}`}
                      checked={item.active}
                      disabled={update.isPending}
                      onCheckedChange={(value) => {
                        update.mutate({ id: item.id, active: value });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Trocar o secret de ${item.repository}`}
                      disabled={update.isPending}
                      onClick={() => {
                        update.mutate({ id: item.id, rotateSecret: true });
                      }}
                    >
                      Trocar secret
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Desligar ${item.repository}`}
                      onClick={() => {
                        setRemoving(item);
                      }}
                    >
                      Desligar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsCard>

      <ConfirmDialog
        open={removing !== null}
        title="Desligar repositório"
        description={`O ${removing?.repository ?? ''} para de atualizar as tarefas deste workspace.`}
        confirmLabel="Desligar"
        danger
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id);
          }
        }}
      />
    </>
  );
}
