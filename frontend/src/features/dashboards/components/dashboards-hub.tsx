import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Lock, MoreHorizontal, Plus, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Dashboard } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { useSession } from '@/features/auth/session';
import { PageHeader } from '@/features/shell/components/page-header';
import { createDashboard, dashboardsQuery, deleteDashboard, updateDashboard } from '../api';
import { cardLabel } from '../card-kinds';

/** Diálogo de criação: nome e se nasce privado. */
function CreateDialog({
  wsId,
  open,
  onOpenChange,
}: {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const create = useMutation({
    mutationFn: () => createDashboard(wsId, { name: name.trim(), private: isPrivate }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards(wsId) });
      toast.success('Dashboard criado.');
      setName('');
      setIsPrivate(false);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo dashboard</DialogTitle>
          <DialogDescription>
            Depois de criar, você monta a grade com os cards que quiser.
          </DialogDescription>
        </DialogHeader>

        {create.isError ? <FormAlert>{errorMessage(create.error)}</FormAlert> : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dashboard-name">Nome</Label>
            <Input
              id="dashboard-name"
              autoFocus
              maxLength={120}
              value={name}
              placeholder="Clientes, Sprint, Diretoria…"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          <label className="flex min-h-11 items-center gap-2 text-[13px] text-body">
            <Checkbox
              checked={isPrivate}
              onCheckedChange={(checked) => {
                setIsPrivate(checked === true);
              }}
            />
            Privado: só eu vejo
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={name.trim() === '' || create.isPending}
            onClick={() => {
              create.mutate();
            }}
          >
            {create.isPending ? <Spinner label="Criando" /> : 'Criar dashboard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DashboardRow({
  wsId,
  dashboard,
  owner,
}: {
  wsId: string;
  dashboard: Dashboard;
  owner: boolean;
}) {
  const queryClient = useQueryClient();
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards(wsId) });
  };

  const share = useMutation({
    mutationFn: () => updateDashboard(wsId, dashboard.id, { private: !dashboard.private }),
    onSuccess: () => {
      refresh();
      toast.success(
        dashboard.private
          ? 'Dashboard compartilhado com o workspace.'
          : 'Dashboard voltou a ser privado.',
      );
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteDashboard(wsId, dashboard.id),
    onSuccess: () => {
      refresh();
      toast.success('Dashboard excluído.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <li className="flex min-w-0 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to="/w/$wsId/dashboards/$dashboardId"
          params={{ wsId, dashboardId: dashboard.id }}
          className="truncate text-[14px] font-medium text-ink hover:text-accent"
        >
          {dashboard.name}
        </Link>
        <span className="truncate text-[12px] text-muted">
          {dashboard.cards.length === 0
            ? 'Sem cards'
            : dashboard.cards.map((card) => cardLabel(card.type)).join(' · ')}
        </span>
      </div>

      {dashboard.private ? (
        <StatusPill tone="neutral">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Privado
        </StatusPill>
      ) : null}

      {owner ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="nav" size="icon" aria-label={`Ações de ${dashboard.name}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={share.isPending}
              onSelect={() => {
                share.mutate();
              }}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {dashboard.private ? 'Compartilhar com o workspace' : 'Tornar privado'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={remove.isPending}
              onSelect={() => {
                remove.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

/** Hub dos dashboards: criar, abrir, compartilhar e excluir. */
export function DashboardsHub({ wsId }: { wsId: string }) {
  const session = useSession();
  const list = useQuery(dashboardsQuery(wsId));
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title="Dashboards"
        description="Painéis com os números do trabalho: status, carga, tempo e progresso."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo dashboard
          </Button>
        }
      />

      <div className="min-w-0 px-4 md:px-6">
        {list.isPending ? (
          <Skeleton className="h-40" />
        ) : list.isError ? (
          <FormAlert>{errorMessage(list.error)}</FormAlert>
        ) : list.data.length === 0 ? (
          <EmptyState
            title="Nenhum dashboard ainda"
            description="Crie o primeiro painel e escolha os cards que a equipe precisa ver."
          />
        ) : (
          <ul className="flex min-w-0 max-w-[880px] flex-col rounded-2xl border border-line bg-surface">
            {list.data.map((dashboard) => (
              <DashboardRow
                key={dashboard.id}
                wsId={wsId}
                dashboard={dashboard}
                owner={dashboard.ownerId === session?.id}
              />
            ))}
          </ul>
        )}
      </div>

      <CreateDialog wsId={wsId} open={creating} onOpenChange={setCreating} />
    </div>
  );
}
