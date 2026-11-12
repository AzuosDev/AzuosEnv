import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { Moon, Plus, Search, SquareArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { NewTaskDialog } from '@/features/tasks/components/new-task-dialog';
import { treeQuery } from '@/features/shell/api';
import { useTheme } from '@/lib/theme';
import type { TreeFolder, WorkspaceTree } from '@/api/types';
import { MIN_SEARCH_TERM, searchQuery } from '../api';
import { searchGroups } from '../search-model';

interface ListEntry {
  id: string;
  /** Caminho até a List, para a ação "Ir para List" não ficar ambígua. */
  name: string;
}

/** Todas as Lists da árvore com a trilha no nome, inclusive em subfolder. */
function flattenLists(tree: WorkspaceTree | undefined): ListEntry[] {
  const entries: ListEntry[] = [];

  const walkFolder = (folder: TreeFolder, trail: string): void => {
    const path = `${trail} · ${folder.name}`;

    for (const list of folder.lists) {
      entries.push({ id: list.id, name: `${path} · ${list.name}` });
    }

    for (const child of folder.folders) {
      walkFolder(child, path);
    }
  };

  for (const space of tree?.spaces ?? []) {
    for (const list of space.lists) {
      entries.push({ id: list.id, name: `${space.name} · ${list.name}` });
    }

    for (const folder of space.folders) {
      walkFolder(folder, space.name);
    }
  }

  return entries;
}

const DEBOUNCE_MS = 250;

/** Atalho Ctrl/Cmd+K abre a busca em qualquer tela do workspace. */
function usePaletteShortcut(open: (value: boolean) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        open(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
}

const groupLabel =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted';

const itemClass =
  'flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 text-[13px] text-body outline-none data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink md:min-h-10';

/**
 * Busca da topbar com Ctrl/Cmd+K: ações rápidas quando o campo está vazio e os
 * resultados do workspace por tipo quando há termo. Abaixo de 768 px a palette
 * ocupa a tela inteira.
 */
export function CommandPalette({ wsId }: { wsId: string }) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');

  usePaletteShortcut(setOpen);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(text.trim());
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  const results = useQuery(searchQuery(wsId, term));
  const tree = useQuery({ ...treeQuery(wsId), enabled: open });
  const groups = useMemo(() => searchGroups(wsId, results.data), [results.data, wsId]);
  const lists = useMemo(() => flattenLists(tree.data), [tree.data]);

  const close = (): void => {
    setOpen(false);
    setText('');
    setTerm('');
  };

  const short = term.length < MIN_SEARCH_TERM;

  return (
    <>
      <button
        type="button"
        aria-keyshortcuts="Control+K"
        onClick={() => {
          setOpen(true);
        }}
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-[13px] text-muted hover:border-scene-line md:h-10 md:max-w-lg"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Buscar tarefas, IDs…</span>
        <span className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] sm:inline">
          Ctrl K
        </span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (value) {
            setOpen(true);
          } else {
            close();
          }
        }}
      >
        <DialogContent className="inset-0 h-dvh max-h-none gap-0 rounded-none p-0 md:inset-x-auto md:left-1/2 md:top-1/2 md:h-auto md:max-h-[70dvh] md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
          <DialogTitle className="sr-only">Buscar no workspace</DialogTitle>
          <DialogDescription className="sr-only">
            Digite para achar tarefas, Lists, Docs, mensagens e pessoas. Use as setas para navegar e
            Enter para abrir.
          </DialogDescription>

          <Command
            loop
            shouldFilter={short}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3 pr-14">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                autoFocus
                value={text}
                onValueChange={setText}
                placeholder="Buscar ou executar uma ação…"
                aria-label="Termo da busca"
                className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink caret-accent outline-none placeholder:text-muted"
              />
              {results.isFetching ? <Spinner label="Buscando" /> : null}
            </div>

            <Command.List className={`min-h-0 flex-1 overflow-y-auto px-2 pb-4 ${groupLabel}`}>
              {short ? null : (
                <Command.Empty className="px-2 py-8 text-center text-[13px] text-muted">
                  {results.isFetching ? 'Buscando…' : `Nada encontrado para “${term}”.`}
                </Command.Empty>
              )}

              {short && term.length > 0 ? (
                <p className="px-2 pt-3 text-[12.5px] text-muted">
                  Digite ao menos {MIN_SEARCH_TERM} letras para buscar no workspace.
                </p>
              ) : null}

              {short ? (
                <>
                  <Command.Group heading="Ações rápidas">
                    <Command.Item
                      className={itemClass}
                      value="Nova tarefa"
                      onSelect={() => {
                        close();
                        setNewTask(true);
                      }}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Nova tarefa
                    </Command.Item>
                    <Command.Item
                      className={itemClass}
                      value="Alternar tema claro escuro"
                      onSelect={() => {
                        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                        close();
                      }}
                    >
                      <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Alternar tema
                    </Command.Item>
                    <Command.Item
                      className={itemClass}
                      value="Inbox"
                      onSelect={() => {
                        close();
                        void navigate({ to: '/w/$wsId/inbox', params: { wsId } });
                      }}
                    >
                      <SquareArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Ir para o Inbox
                    </Command.Item>
                    <Command.Item
                      className={itemClass}
                      value="Minhas tarefas"
                      onSelect={() => {
                        close();
                        void navigate({ to: '/w/$wsId/minhas-tarefas', params: { wsId } });
                      }}
                    >
                      <SquareArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Ir para Minhas tarefas
                    </Command.Item>
                  </Command.Group>

                  {lists.length > 0 ? (
                    <Command.Group heading="Ir para List">
                      {lists.map((list) => (
                        <Command.Item
                          key={list.id}
                          className={itemClass}
                          value={`List ${list.name}`}
                          onSelect={() => {
                            close();
                            void navigate({
                              to: '/w/$wsId/l/$listId',
                              params: { wsId, listId: list.id },
                            });
                          }}
                        >
                          <SquareArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 truncate">{list.name}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : (
                groups.map((group) => (
                  <Command.Group key={group.type} heading={group.label}>
                    {group.rows.map((row) => (
                      <Command.Item
                        key={`${group.type}-${row.id}`}
                        className={itemClass}
                        value={`${group.type}-${row.id}`}
                        disabled={row.target === null}
                        onSelect={() => {
                          if (!row.target) {
                            return;
                          }

                          close();
                          void navigate(row.target);
                        }}
                      >
                        {row.hint === '' ? null : (
                          <span className="shrink-0 text-[12px] text-muted">{row.hint}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{row.title}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>

      <NewTaskDialog wsId={wsId} open={newTask} onOpenChange={setNewTask} />
    </>
  );
}
