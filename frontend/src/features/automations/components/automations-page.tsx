import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { Automation, AutomationRecipe } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { treeQuery } from '@/features/shell/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { crumbsOf, findLocation } from '@/features/shell/tree-path';
import { TemplateGallery } from '@/features/templates/components/template-gallery';
import {
  automationsQuery,
  deleteAutomation,
  recipesQuery,
  runsQuery,
  updateAutomation,
} from '../api';
import { LOCATION_TYPE_LABEL, RUN_STATUS_LABEL, RUN_STATUS_TONE } from '../automation-fields';
import { describeAutomation, groupByLocation } from '../automation-model';
import { AutomationBuilder } from './automation-builder';

type PageTab = 'rules' | 'runs' | 'templates';

const TAB_LABEL: Record<PageTab, string> = {
  rules: 'Regras',
  runs: 'Histórico',
  templates: 'Templates',
};

/** Data e hora curtas em pt-BR, no fuso do navegador. */
function when(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function AutomationRow({ wsId, automation }: { wsId: string; automation: Automation }) {
  const queryClient = useQueryClient();
  const sentence = describeAutomation(automation);
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'automations'] });
  };

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateAutomation(wsId, automation.id, { active }),
    onSuccess: refresh,
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteAutomation(wsId, automation.id),
    onSuccess: () => {
      refresh();
      toast.success('Automação excluída.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 basis-[300px] flex-col gap-1">
        <span className="truncate text-[14px] font-semibold text-ink">{automation.name}</span>

        <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-[11px] font-bold tracking-wider text-muted">QUANDO</span>
          <span className="text-ink">{sentence.when}</span>
        </span>

        {sentence.conditions.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="text-[11px] font-bold tracking-wider text-muted">SE</span>
            <span className="text-body">{sentence.conditions.join(' e ')}</span>
          </span>
        ) : null}

        <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-[11px] font-bold tracking-wider text-accent">ENTÃO</span>
          <span className="text-body">{sentence.then}</span>
        </span>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-[13px] text-body">
        <Switch
          aria-label={`Ligar ${automation.name}`}
          checked={automation.active}
          disabled={toggle.isPending}
          onCheckedChange={(checked) => {
            toggle.mutate(checked);
          }}
        />
        {automation.active ? 'Ativa' : 'Desligada'}
      </label>

      <Button
        variant="nav"
        size="icon"
        aria-label={`Excluir ${automation.name}`}
        disabled={remove.isPending}
        onClick={() => {
          remove.mutate();
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  );
}

/** Lista por local, com o nome do local saindo da árvore. */
function RulesTab({
  wsId,
  onRecipe,
}: {
  wsId: string;
  onRecipe: (recipe: AutomationRecipe) => void;
}) {
  const list = useQuery(automationsQuery(wsId));
  const tree = useQuery(treeQuery(wsId));
  const recipes = useQuery(recipesQuery(wsId));

  const locationName = (locationType: Automation['locationType'], locationId: string): string => {
    if (!tree.data) {
      return LOCATION_TYPE_LABEL[locationType];
    }

    const node = findLocation(tree.data, locationType, locationId);

    if (!node) {
      return LOCATION_TYPE_LABEL[locationType];
    }

    return crumbsOf(node)
      .map((crumb) => crumb.name)
      .join(' / ');
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-ink">Receitas prontas</h2>
        <p className="text-[12.5px] text-muted">
          Um clique abre o construtor já preenchido; você só completa o que falta.
        </p>
        <ul className="flex flex-wrap gap-2">
          {(recipes.data ?? []).map((recipe) => (
            <li key={recipe.key}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRecipe(recipe);
                }}
              >
                {recipe.name}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {list.isPending ? (
        <Skeleton className="h-40" />
      ) : list.isError ? (
        <FormAlert>{errorMessage(list.error)}</FormAlert>
      ) : list.data.length === 0 ? (
        <EmptyState
          title="Nenhuma automação ainda"
          description="Crie uma regra para o trabalho repetitivo acontecer sozinho."
        />
      ) : (
        groupByLocation(list.data).map((group) => (
          <section key={group.key} className="flex min-w-0 flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted">
              {locationName(group.locationType, group.locationId)}
            </h2>
            <ul className="flex min-w-0 max-w-[880px] flex-col rounded-2xl border border-line bg-surface">
              {group.items.map((automation) => (
                <AutomationRow key={automation.id} wsId={wsId} automation={automation} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** Histórico: escolhe a automação e lê as execuções, com o erro quando houve. */
function RunsTab({ wsId }: { wsId: string }) {
  const list = useQuery(automationsQuery(wsId));
  const [automationId, setAutomationId] = useState('');
  const chosen = automationId || list.data?.[0]?.id || '';
  const runs = useInfiniteQuery({ ...runsQuery(wsId, chosen), enabled: chosen !== '' });
  const items = (runs.data?.pages ?? []).flatMap((page) => page.items);

  if (list.isPending) {
    return <Skeleton className="h-40" />;
  }

  if (list.isError) {
    return <FormAlert>{errorMessage(list.error)}</FormAlert>;
  }

  if (list.data.length === 0) {
    return (
      <EmptyState
        title="Nada executado ainda"
        description="Quando você tiver automações, cada execução aparece aqui com o resultado."
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex max-w-[420px] flex-col gap-1.5">
        <label htmlFor="runs-automation" className="text-[12.5px] text-muted">
          Automação
        </label>
        <SelectNative
          id="runs-automation"
          value={chosen}
          onChange={(event) => {
            setAutomationId(event.target.value);
          }}
        >
          {list.data.map((automation) => (
            <option key={automation.id} value={automation.id}>
              {automation.name}
            </option>
          ))}
        </SelectNative>
      </div>

      {runs.isPending ? (
        <Skeleton className="h-32" />
      ) : runs.isError ? (
        <FormAlert>{errorMessage(runs.error)}</FormAlert>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sem execuções"
          description="Esta automação ainda não rodou. Ela dispara quando o gatilho acontecer."
        />
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">Execuções da automação</caption>
            <thead>
              <tr className="bg-surface-2 text-left">
                <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
                  Quando
                </th>
                <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
                  Resultado
                </th>
                <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
                  Ações
                </th>
                <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
                  Erro
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((run) => (
                <tr key={run.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                    {when(run.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill tone={RUN_STATUS_TONE[run.status]}>
                      {RUN_STATUS_LABEL[run.status]}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2.5 text-body">{run.actionsExecuted}</td>
                  <td className="max-w-[260px] px-3 py-2.5 text-danger">{run.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {runs.hasNextPage ? (
        <Button
          variant="nav"
          size="sm"
          className="self-start"
          disabled={runs.isFetchingNextPage}
          onClick={() => {
            void runs.fetchNextPage();
          }}
        >
          {runs.isFetchingNextPage ? <Spinner label="Carregando" /> : 'Carregar mais'}
        </Button>
      ) : null}
    </div>
  );
}

/** Automações: regras por local, histórico de execuções e galeria de templates. */
export function AutomationsPage({ wsId }: { wsId: string }) {
  const [tab, setTab] = useState<PageTab>('rules');
  const [building, setBuilding] = useState(false);
  const [recipe, setRecipe] = useState<AutomationRecipe | undefined>(undefined);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title="Automações"
        description="Quando algo acontece, o Azuos Env faz o resto por você."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setRecipe(undefined);
              setBuilding(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova automação
          </Button>
        }
      />

      <div className="min-w-0 px-4 md:px-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as PageTab);
          }}
          className="flex min-w-0 flex-col"
        >
          <TabsList className="min-w-0 overflow-x-auto">
            {(['rules', 'runs', 'templates'] as PageTab[]).map((value) => (
              <TabsTrigger key={value} value={value} className="shrink-0">
                {TAB_LABEL[value]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="rules">
            {tab === 'rules' ? (
              <RulesTab
                wsId={wsId}
                onRecipe={(chosen) => {
                  setRecipe(chosen);
                  setBuilding(true);
                }}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="runs">{tab === 'runs' ? <RunsTab wsId={wsId} /> : null}</TabsContent>
          <TabsContent value="templates">
            {tab === 'templates' ? <TemplateGallery wsId={wsId} /> : null}
          </TabsContent>
        </Tabs>
      </div>

      <AutomationBuilder wsId={wsId} open={building} onOpenChange={setBuilding} recipe={recipe} />
    </div>
  );
}
