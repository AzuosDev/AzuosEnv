import { Copy, Lock, MoreHorizontal, Pencil, Pin, Plus, Shield, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { View } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { cn } from '@/lib/utils';
import type { useViewActions } from '../hooks/use-view-actions';
import {
  SUPPORTED_VIEW_TYPES,
  VIEW_TYPE_ICON,
  VIEW_TYPE_LABEL,
  isSupportedViewType,
} from '../view-kinds';

export interface ViewsBarProps {
  views: View[];
  activeId: string | null;
  onPick: (viewId: string) => void;
  actions: ReturnType<typeof useViewActions>;
  /** Id do usuário logado: só o dono muda uma view protegida. */
  userId: string | undefined;
}

function canChange(view: View, userId: string | undefined): boolean {
  return !view.protected || view.ownerId === userId;
}

function ViewTab({ view, active, onPick }: { view: View; active: boolean; onPick: () => void }) {
  const Icon = isSupportedViewType(view.type) ? VIEW_TYPE_ICON[view.type] : Star;
  const badges = [
    view.pinned ? 'fixada' : null,
    view.private ? 'privada' : null,
    view.protected ? 'protegida' : null,
    view.isDefault ? 'padrão' : null,
  ].filter((badge): badge is string => badge !== null);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={cn(
        'flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13px] md:h-10',
        active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {view.name}
      {view.pinned ? <Pin className="h-3 w-3 text-accent" aria-hidden="true" /> : null}
      {view.private ? <Lock className="h-3 w-3 text-muted" aria-hidden="true" /> : null}
      {view.protected ? <Shield className="h-3 w-3 text-muted" aria-hidden="true" /> : null}
      {view.isDefault ? <Star className="h-3 w-3 text-muted" aria-hidden="true" /> : null}
      {badges.length > 0 ? <span className="sr-only">({badges.join(', ')})</span> : null}
    </button>
  );
}

/**
 * Barra de views do local: abas das views salvas, menu de cada uma e o botão de
 * adicionar. As views ficam na ordem manual que a API devolve, com as fixadas na
 * frente.
 */
export function ViewsBar({ views, activeId, onPick, actions, userId }: ViewsBarProps) {
  const [renaming, setRenaming] = useState<View | null>(null);
  const [removing, setRemoving] = useState<View | null>(null);
  const [name, setName] = useState('');
  const ordered = [...views].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const active = views.find((view) => view.id === activeId) ?? null;
  const editable = active ? canChange(active, userId) : false;

  return (
    <div className="flex flex-wrap items-end gap-1 border-b border-line px-3 md:px-6">
      <div className="-mb-px flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
        {ordered.map((view) => (
          <ViewTab
            key={view.id}
            view={view}
            active={view.id === activeId}
            onPick={() => {
              onPick(view.id);
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 py-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="nav" size="sm" aria-label="Adicionar view">
              <Plus className="h-4 w-4" aria-hidden="true" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Nova view</DropdownMenuLabel>
            {SUPPORTED_VIEW_TYPES.map((type) => {
              const Icon = VIEW_TYPE_ICON[type];

              return (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => {
                    actions.create.mutate({ type, name: VIEW_TYPE_LABEL[type] });
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {VIEW_TYPE_LABEL[type]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {active ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="nav" size="sm" aria-label={`Ações da view ${active.name}`}>
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                disabled={!editable}
                onSelect={() => {
                  setName(active.name);
                  setRenaming(active);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  actions.duplicate.mutate({ viewId: active.id });
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!editable}
                onSelect={() => {
                  actions.update.mutate({
                    viewId: active.id,
                    body: { pinned: !active.pinned },
                  });
                }}
              >
                <Pin className="h-4 w-4" aria-hidden="true" />
                {active.pinned ? 'Desafixar' : 'Fixar'}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editable || active.isDefault}
                onSelect={() => {
                  actions.update.mutate({ viewId: active.id, body: { isDefault: true } });
                }}
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                Definir como padrão
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editable}
                onSelect={() => {
                  actions.update.mutate({
                    viewId: active.id,
                    body: { private: !active.private },
                  });
                }}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                {active.private ? 'Deixar visível para todos' : 'Tornar privada'}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editable}
                onSelect={() => {
                  actions.update.mutate({
                    viewId: active.id,
                    body: { protected: !active.protected },
                  });
                }}
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                {active.protected ? 'Liberar edição' : 'Proteger (só o dono edita)'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!editable || views.length === 1}
                className="text-danger"
                onSelect={() => {
                  setRemoving(active);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Renomear view</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();

              if (renaming && name.trim() !== '') {
                actions.update.mutate({ viewId: renaming.id, body: { name: name.trim() } });
                setRenaming(null);
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-name">Nome</Label>
              <Input
                id="view-name"
                value={name}
                autoFocus
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRenaming(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={name.trim() === ''}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        title="Excluir view"
        description={`A view "${removing?.name ?? ''}" sai do local. As tarefas continuam onde estão.`}
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (removing) {
            actions.remove.mutate({ viewId: removing.id, name: removing.name });
            setRemoving(null);
          }
        }}
      />
    </div>
  );
}
