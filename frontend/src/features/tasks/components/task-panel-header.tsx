import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  ArrowRightLeft,
  Bell,
  BellOff,
  Check,
  Copy,
  Columns2,
  Link2,
  ListPlus,
  Maximize2,
  MoreHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { EffectiveStatus, TaskDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import type { TreeCrumb } from '@/features/shell/tree-path';
import { PANEL_MODE_LABEL, type PanelMode } from '../panel-mode';
import { statusTone } from '../task-fields';
import { StatusPicker } from './task-pickers';

export interface TaskPanelHeaderProps {
  wsId: string;
  task: TaskDetail;
  statuses: EffectiveStatus[];
  crumbs: TreeCrumb[];
  /** Null abaixo de 1024: lá o painel é sempre tela cheia. */
  mode: PanelMode | null;
  following: boolean;
  onMode: (mode: PanelMode) => void;
  onStatus: (statusId: string) => void;
  onFollow: () => void;
  onMove: () => void;
  onAddList: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const MODE_ICON: Record<PanelMode, typeof Columns2> = {
  side: Columns2,
  modal: Square,
  full: Maximize2,
};

/** Link público da tarefa, o mesmo que a rota abre. */
export function taskLink(wsId: string, customId: string, origin: string): string {
  return `${origin}/w/${wsId}/t/${customId}`;
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Link copiado.');
  } catch {
    toast.error('O navegador não deixou copiar. Copie da barra de endereço.');
  }
}

/**
 * Cabeçalho do painel: trilha da List, id com copiar link, status com "Mover
 * para …", concluir, seguir, menu de ações e os modos do painel.
 */
export function TaskPanelHeader({
  wsId,
  task,
  statuses,
  crumbs,
  mode,
  following,
  onMode,
  onStatus,
  onFollow,
  onMove,
  onAddList,
  onArchive,
  onDelete,
  onClose,
}: TaskPanelHeaderProps) {
  const status = statuses.find((option) => option.id === task.statusId);
  const index = statuses.findIndex((option) => option.id === task.statusId);
  const next = index >= 0 ? statuses[index + 1] : undefined;
  const closed = task.statusGroup === 'done' || task.statusGroup === 'closed';
  const doneStatus = statuses.find((option) => option.group === 'done');
  const openStatus = statuses.find(
    (option) => option.group === 'notStarted' || option.group === 'active',
  );
  const link = taskLink(wsId, task.customId, window.location.origin);

  return (
    <header className="flex flex-col gap-3 border-b border-line bg-surface px-3 pb-3 pt-3 md:px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="nav"
          size="icon"
          aria-label={mode === null ? 'Voltar' : 'Fechar tarefa'}
          className="h-9 w-9 shrink-0"
          onClick={onClose}
        >
          {mode === null ? (
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>

        <nav aria-label="Trilha da tarefa" className="flex min-w-0 flex-1 items-center gap-1">
          {crumbs.map((crumb) => (
            <span key={crumb.id} className="flex min-w-0 items-center gap-1">
              {crumb.kind === 'space' ? (
                <Link
                  to="/w/$wsId/s/$spaceId"
                  params={{ wsId, spaceId: crumb.id }}
                  className="truncate text-[12px] text-muted hover:text-ink"
                >
                  {crumb.name}
                </Link>
              ) : null}
              {crumb.kind === 'folder' ? (
                <Link
                  to="/w/$wsId/f/$folderId"
                  params={{ wsId, folderId: crumb.id }}
                  className="truncate text-[12px] text-muted hover:text-ink"
                >
                  {crumb.name}
                </Link>
              ) : null}
              {crumb.kind === 'list' ? (
                <Link
                  to="/w/$wsId/l/$listId"
                  params={{ wsId, listId: crumb.id }}
                  className="truncate text-[12px] text-muted hover:text-ink"
                >
                  {crumb.name}
                </Link>
              ) : null}
              <span aria-hidden="true" className="text-muted">
                ·
              </span>
            </span>
          ))}
          <button
            type="button"
            title="Copiar link da tarefa"
            aria-label={`Copiar link de ${task.customId}`}
            className="flex shrink-0 items-center gap-1 rounded-lg px-1 text-[12px] text-muted hover:bg-surface-2 hover:text-ink"
            onClick={() => {
              void copy(link);
            }}
          >
            {task.customId}
            <Copy className="h-3 w-3" aria-hidden="true" />
          </button>
        </nav>

        {mode !== null ? (
          <div
            role="group"
            aria-label="Modo do painel"
            className="hidden shrink-0 items-center gap-0.5 lg:flex"
          >
            {(Object.keys(MODE_ICON) as PanelMode[]).map((option) => {
              const Icon = MODE_ICON[option];

              return (
                <Button
                  key={option}
                  variant="nav"
                  size="icon"
                  aria-label={PANEL_MODE_LABEL[option]}
                  aria-pressed={mode === option}
                  className="h-9 w-9 aria-pressed:bg-surface-2 aria-pressed:text-accent"
                  onClick={() => {
                    onMode(option);
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPicker statuses={statuses} value={task.statusId} onSelect={onStatus}>
          <button type="button" aria-label="Trocar o status da tarefa">
            <StatusPill tone={statusTone(task.statusGroup, status?.color)}>
              {status?.name ?? 'Status'}
            </StatusPill>
          </button>
        </StatusPicker>

        {next ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onStatus(next.id);
            }}
          >
            Mover para {next.name}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}

        {closed ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={!openStatus}
            onClick={() => {
              if (openStatus) {
                onStatus(openStatus.id);
              }
            }}
          >
            Reabrir
          </Button>
        ) : (
          <Button
            variant="signal"
            size="sm"
            disabled={!doneStatus}
            onClick={() => {
              if (doneStatus) {
                onStatus(doneStatus.id);
              }
            }}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Concluir
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          aria-pressed={following}
          className="aria-pressed:text-accent"
          onClick={onFollow}
        >
          {following ? (
            <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {following ? 'Seguindo' : 'Seguir'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="nav"
              size="icon"
              aria-label={`Ações de ${task.customId}`}
              className="h-9 w-9"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onMove}>
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              Mover
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddList}>
              <ListPlus className="h-4 w-4" aria-hidden="true" />
              Adicionar a outra List
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void copy(link);
              }}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Copiar link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              <Archive className="h-4 w-4" aria-hidden="true" />
              Arquivar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
