import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { ClickAppKey, ClickApps, ClickAppsOverride } from '@/api/types';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { spaceQuery } from '@/features/hierarchy/api';
import { SettingsCard, SettingsRow } from '@/features/settings/components/settings-card';
import { updateWorkspace, workspaceQuery } from '@/features/settings/api';
import { treeQuery } from '@/features/shell/api';
import {
  CLICK_APP_DESCRIPTION,
  CLICK_APP_KEYS,
  CLICK_APP_LABEL,
  effectiveClickApp,
  overrideCount,
  toggleOverride,
} from '../clickapps';
import { updateSpaceClickApps } from '../api';

type SpaceChoice = 'workspace' | string;

/** ClickApps do workspace e, por Space, o que foge do padrão. */
export function ClickAppsPanel({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const spaceSelectId = useId();
  const { data: detail } = useSuspenseQuery(workspaceQuery(wsId));
  const tree = useQuery(treeQuery(wsId));
  const [scope, setScope] = useState<SpaceChoice>('workspace');
  const space = useQuery({ ...spaceQuery(wsId, scope), enabled: scope !== 'workspace' });

  const workspaceApps = detail.workspace.settings.clickApps;
  const spaces = tree.data?.spaces ?? [];
  const override = (space.data?.clickApps ?? undefined) as ClickAppsOverride | undefined;

  const saveWorkspace = useMutation({
    mutationFn: (clickApps: ClickApps) => updateWorkspace(wsId, { settings: { clickApps } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(wsId) });
      toast.success('ClickApps do workspace salvos.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const saveSpace = useMutation({
    mutationFn: (clickApps: ClickAppsOverride) => updateSpaceClickApps(wsId, scope, clickApps),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.space(wsId, scope) });
      toast.success('ClickApps do Space salvos.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const toggleWorkspace = (key: ClickAppKey, value: boolean): void => {
    saveWorkspace.mutate({ ...workspaceApps, [key]: value });
  };

  const changeSpace = (key: ClickAppKey, value: boolean | 'inherit'): void => {
    saveSpace.mutate(toggleOverride(override, key, value));
  };

  return (
    <>
      <SettingsCard
        title="Onde aplicar"
        description="O Space pode seguir o workspace ou decidir por conta própria."
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={spaceSelectId}>Escopo</Label>
          <SelectNative
            id={spaceSelectId}
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
            }}
          >
            <option value="workspace">Todo o workspace</option>
            {spaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectNative>
          {scope !== 'workspace' ? (
            <p className="text-[12.5px] text-muted">
              {overrideCount(override) === 0
                ? 'Este Space segue o workspace em tudo.'
                : `Este Space decide ${String(overrideCount(override))} de ${String(
                    CLICK_APP_KEYS.length,
                  )} ClickApps.`}
            </p>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title={scope === 'workspace' ? 'ClickApps do workspace' : 'ClickApps deste Space'}
        description={
          scope === 'workspace'
            ? 'Valem em todos os Spaces que não decidirem o contrário.'
            : 'Herdar devolve a decisão para o workspace.'
        }
      >
        <div className="flex flex-col">
          {CLICK_APP_KEYS.map((key, index) => {
            const last = index === CLICK_APP_KEYS.length - 1;

            if (scope === 'workspace') {
              return (
                <SettingsRow
                  key={key}
                  last={last}
                  title={CLICK_APP_LABEL[key]}
                  description={CLICK_APP_DESCRIPTION[key]}
                  control={
                    <Switch
                      aria-label={CLICK_APP_LABEL[key]}
                      checked={workspaceApps[key]}
                      disabled={saveWorkspace.isPending}
                      onCheckedChange={(value) => {
                        toggleWorkspace(key, value);
                      }}
                    />
                  }
                />
              );
            }

            const own = override?.[key];
            const value = own === undefined ? 'inherit' : own ? 'on' : 'off';

            return (
              <SettingsRow
                key={key}
                last={last}
                title={CLICK_APP_LABEL[key]}
                description={
                  own === undefined
                    ? `Herdado do workspace: ${
                        effectiveClickApp(key, workspaceApps, override) ? 'ligado' : 'desligado'
                      }`
                    : CLICK_APP_DESCRIPTION[key]
                }
                control={
                  <SelectNative
                    aria-label={CLICK_APP_LABEL[key]}
                    className="w-36"
                    value={value}
                    disabled={saveSpace.isPending || space.isPending}
                    onChange={(event) => {
                      const next = event.target.value;

                      changeSpace(key, next === 'inherit' ? 'inherit' : next === 'on');
                    }}
                  >
                    <option value="inherit">Herdar</option>
                    <option value="on">Ligado</option>
                    <option value="off">Desligado</option>
                  </SelectNative>
                }
              />
            );
          })}
        </div>
      </SettingsCard>
    </>
  );
}
