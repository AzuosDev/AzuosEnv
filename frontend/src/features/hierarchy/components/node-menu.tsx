import {
  Archive,
  CircleDot,
  Copy,
  FolderPlus,
  ListPlus,
  MoreHorizontal,
  MoveRight,
  Palette,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { favoriteOf } from '@/features/favorites/favorite-model';
import { useFavorites } from '@/features/favorites/hooks/use-favorites';
import { cn } from '@/lib/utils';
import { NODE_LABEL } from '../node-kinds';
import type { FlatNode } from '../tree-dnd';
import { useHierarchy } from './hierarchy-provider';

const itemIcon = 'h-4 w-4 shrink-0 text-muted';

export interface NodeMenuProps {
  node: FlatNode;
  /** `sm` encolhe os botões na sidebar; o alvo de toque segue ≥ 44 px. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Menu "+" de um Space ou Folder: cria Folder ou List dentro dele. */
export function AddMenu({ node, size = 'md', className }: NodeMenuProps) {
  const { open } = useHierarchy();
  const canNestFolder = node.kind === 'space' || node.folderId === null;

  if (node.kind === 'list') {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="nav"
          size="icon"
          aria-label={`Criar dentro de ${node.name}`}
          className={cn(size === 'sm' && 'h-9 w-7', className)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {canNestFolder ? (
          <DropdownMenuItem
            onSelect={() => {
              open({
                type: 'createFolder',
                parent: {
                  spaceId: node.spaceId,
                  parentFolderId: node.kind === 'folder' ? node.id : null,
                },
              });
            }}
          >
            <FolderPlus className={itemIcon} aria-hidden="true" />
            {node.kind === 'folder' ? 'Nova subfolder' : 'Novo Folder'}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => {
            open({
              type: 'createList',
              parent: {
                spaceId: node.spaceId,
                folderId: node.kind === 'folder' ? node.id : null,
              },
            });
          }}
        >
          <ListPlus className={itemIcon} aria-hidden="true" />
          Nova List
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Menu "…" do item da hierarquia, o mesmo no desktop e por toque no celular. */
export function NodeMenu({
  node,
  size = 'md',
  className,
  includeCreate = false,
}: NodeMenuProps & { includeCreate?: boolean }) {
  const { open, wsId } = useHierarchy();
  const { items, toggle } = useFavorites(wsId);
  const favourite = favoriteOf(items, node.kind, node.id) !== null;
  const canNestFolder = node.kind === 'space' || node.folderId === null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="nav"
          size="icon"
          aria-label={`Ações de ${node.name}`}
          className={cn(size === 'sm' && 'h-11 w-11 md:h-9 md:w-7', className)}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {includeCreate && node.kind !== 'list' ? (
          <>
            {canNestFolder ? (
              <DropdownMenuItem
                onSelect={() => {
                  open({
                    type: 'createFolder',
                    parent: {
                      spaceId: node.spaceId,
                      parentFolderId: node.kind === 'folder' ? node.id : null,
                    },
                  });
                }}
              >
                <FolderPlus className={itemIcon} aria-hidden="true" />
                {node.kind === 'folder' ? 'Nova subfolder' : 'Novo Folder'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => {
                open({
                  type: 'createList',
                  parent: {
                    spaceId: node.spaceId,
                    folderId: node.kind === 'folder' ? node.id : null,
                  },
                });
              }}
            >
              <ListPlus className={itemIcon} aria-hidden="true" />
              Nova List
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem
          onSelect={() => {
            toggle(node.kind, node.id);
          }}
        >
          <Star className={itemIcon} aria-hidden="true" />
          {favourite ? 'Tirar dos favoritos' : 'Favoritar'}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            open({ type: 'edit', node, focus: 'name' });
          }}
        >
          <Pencil className={itemIcon} aria-hidden="true" />
          Renomear
        </DropdownMenuItem>

        {node.kind === 'folder' ? null : (
          <DropdownMenuItem
            onSelect={() => {
              open({ type: 'edit', node, focus: 'appearance' });
            }}
          >
            <Palette className={itemIcon} aria-hidden="true" />
            {node.kind === 'space' ? 'Cor e ícone' : 'Cor'}
          </DropdownMenuItem>
        )}

        {node.kind === 'space' ? null : (
          <DropdownMenuItem
            onSelect={() => {
              open({ type: 'move', node });
            }}
          >
            <MoveRight className={itemIcon} aria-hidden="true" />
            Mover
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onSelect={() => {
            open({ type: 'statuses', node });
          }}
        >
          <CircleDot className={itemIcon} aria-hidden="true" />
          Statuses
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            open({ type: 'share', node });
          }}
        >
          <UserPlus className={itemIcon} aria-hidden="true" />
          Compartilhar
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            open({ type: 'template', node });
          }}
        >
          <Copy className={itemIcon} aria-hidden="true" />
          Salvar como template
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            open({ type: 'archive', node });
          }}
        >
          <Archive className={itemIcon} aria-hidden="true" />
          Arquivar
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-danger data-[highlighted]:text-danger"
          onSelect={() => {
            open({ type: 'delete', node });
          }}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Excluir {NODE_LABEL[node.kind]}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
