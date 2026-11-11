import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { History, PanelLeft, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { DocPage, MovePageInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { SummarizeButton } from '@/features/ai/components/summarize-button';
import { membersQuery } from '@/features/settings/api';
import { useMentionSearch } from '@/features/tasks/hooks/use-mention-search';
import { useMinWidth } from '@/lib/use-min-width';
import {
  createPage,
  deletePage,
  docPageQuery,
  docPagesQuery,
  docQuery,
  movePage,
  updatePage,
} from '../api';
import { useDocRealtime } from '../hooks/use-doc-realtime';
import { usePageSave } from '../hooks/use-page-save';
import { pagePath, planPageMove, type DropPosition } from '../page-tree';
import { MAX_IMAGE_BYTES, PageEditor } from './page-editor';
import { PageCommentsPanel } from './page-comments-panel';
import { PageTreePanel } from './page-tree-panel';
import { ShareDialog } from './share-dialog';
import { VersionHistoryDialog } from './version-history-dialog';

export interface DocEditorProps {
  wsId: string;
  docId: string;
  /** Página aberta pela URL; sem ela abre a primeira da árvore. */
  pageId?: string;
  onPickPage: (pageId: string) => void;
}

const SAVE_LABEL: Record<string, string> = {
  idle: '',
  saving: 'Salvando…',
  saved: 'Salvo',
  conflict: 'Conflito',
  error: 'Falhou ao salvar',
};

/** Lê a imagem escolhida como data URL; o conteúdo da página é JSON livre. */
function pickImageFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);

        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        toast.error('A imagem precisa ter menos de 1 MB.');
        resolve(null);

        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(file);
    };

    input.click();
  });
}

/** Ids das tarefas mencionadas no conteúdo, para o backend guardar na página. */
function mentionedTasks(doc: JSONContent): string[] {
  const ids = new Set<string>();

  const walk = (node: JSONContent): void => {
    if (node.type === 'taskMention') {
      const id = (node.attrs as { id?: unknown } | undefined)?.id;

      if (typeof id === 'string' && id !== '') {
        ids.add(id);
      }
    }

    node.content?.forEach(walk);
  };

  walk(doc);

  return [...ids];
}

/**
 * Tela do Doc: árvore à esquerda (drawer abaixo de 1024), editor no meio e
 * comentários à direita. O salvamento é automático, com aviso de conflito.
 */
export function DocEditor({ wsId, docId, pageId, onPickPage }: DocEditorProps) {
  const client = useQueryClient();
  const user = useSession();
  const wide = useMinWidth(1024);
  const doc = useQuery(docQuery(wsId, docId));
  const pages = useQuery(docPagesQuery(wsId, docId));
  const members = useQuery(membersQuery(wsId));
  const items = pages.data ?? [];
  const openId = pageId ?? items[0]?.id;
  const page = useQuery({ ...docPageQuery(wsId, openId ?? ''), enabled: openId !== undefined });
  const current: DocPage | undefined = page.data;
  const save = usePageSave(wsId, current);
  const [title, setTitle] = useState('');
  const [anchor, setAnchor] = useState('');
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  /** Sobe quando o conteúdo vem de fora (recarregar ou restaurar) e o editor precisa remontar. */
  const [epoch, setEpoch] = useState(0);
  const { searchPeople, searchTasks } = useMentionSearch(wsId, members.data ?? []);

  useDocRealtime({
    wsId,
    docId,
    pageId: openId,
    onPageUpdated: save.markStale,
  });

  useEffect(() => {
    setTitle(current?.title ?? '');
    setAnchor('');
  }, [current?.id, current?.version, current?.title]);

  const add = useMutation({
    mutationFn: (parentPageId: string | null) =>
      createPage(wsId, docId, {
        title: 'Nova página',
        ...(parentPageId !== null ? { parentPageId } : {}),
      }),
    onSuccess: async (created) => {
      await client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });
      onPickPage(created.id);
      setTreeOpen(false);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (target: string) => deletePage(wsId, target),
    onSuccess: async (_result, target) => {
      await client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });

      if (target === openId) {
        const next = items.find((item) => item.id !== target);

        if (next) {
          onPickPage(next.id);
        }
      }
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const rename = useMutation({
    mutationFn: ({ pageId: target, title: next }: { pageId: string; title: string }) => {
      const item = items.find((entry) => entry.id === target);

      return updatePage(wsId, target, { version: item?.version ?? 1, title: next });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const move = useMutation({
    mutationFn: ({ pageId: target, ...body }: MovePageInput & { pageId: string }) =>
      movePage(wsId, target, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const onMove = (activeId: string, overId: string, position: DropPosition): void => {
    const plan = planPageMove(items, { activeId, overId, position });

    if (plan) {
      move.mutate(plan);
    }
  };

  const canEdit = doc.data !== undefined;
  const trail = openId === undefined ? [] : pagePath(items, openId);

  const tree = (
    <PageTreePanel
      pages={items}
      activeId={openId}
      canEdit={canEdit}
      onPick={(id) => {
        onPickPage(id);
        setTreeOpen(false);
      }}
      onCreate={(parentPageId) => {
        add.mutate(parentPageId);
      }}
      onRename={(id, next) => {
        if (id === openId) {
          setTitle(next);
          save.queue({ title: next });

          return;
        }

        rename.mutate({ pageId: id, title: next });
      }}
      onDelete={(id) => {
        remove.mutate(id);
      }}
      onMove={onMove}
    />
  );

  if (doc.isPending) {
    return (
      <div className="p-6">
        <Spinner label="Carregando o Doc" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {wide ? (
        <aside
          aria-label="Páginas"
          className="flex w-[272px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-paper-2 p-3"
        >
          <h1 className="heading px-2 text-[18px]">{doc.data?.title}</h1>
          {tree}
        </aside>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
          {!wide ? (
            <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir páginas do Doc">
                  <PanelLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-3">
                <SheetTitle className="px-2 text-[16px]">{doc.data?.title}</SheetTitle>
                {tree}
              </SheetContent>
            </Sheet>
          ) : null}

          <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
            {[doc.data?.title, ...trail.map((item) => item.title)].join(' / ')}
          </p>

          {save.state !== 'idle' ? (
            <span
              role="status"
              aria-label="Estado do salvamento"
              className={
                save.state === 'conflict' || save.state === 'error'
                  ? 'text-[12px] text-danger'
                  : 'text-[12px] text-muted'
              }
            >
              {SAVE_LABEL[save.state]}
            </span>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            disabled={openId === undefined}
            onClick={() => {
              setHistory(true);
            }}
          >
            <History className="h-4 w-4" aria-hidden="true" /> Histórico de versões
          </Button>

          <SummarizeButton wsId={wsId} entityType="doc" id={docId} />

          <Button
            size="sm"
            onClick={() => {
              setSharing(true);
            }}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" /> Compartilhar
          </Button>
        </header>

        {save.stale ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-[12.5px] text-ink"
          >
            <span className="min-w-0 flex-1">
              Esta página mudou. Atualize para ver a versão nova.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void save.reload().then(() => {
                  setEpoch((value) => value + 1);
                });
              }}
            >
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={save.dismissStale}>
              Depois
            </Button>
          </div>
        ) : null}

        {save.state === 'conflict' ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 border-b border-danger/40 bg-danger/10 px-4 py-2 text-[12.5px] text-ink"
          >
            <span className="min-w-0 flex-1">Alguém editou esta página.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void save.reload().then(() => {
                  setEpoch((value) => value + 1);
                });
              }}
            >
              Recarregar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                void save.overwrite();
              }}
            >
              Sobrescrever
            </Button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 lg:flex-row lg:p-6">
          {openId === undefined ? (
            <p className="text-[13px] text-muted">
              Este Doc ainda não tem páginas. Crie a primeira pela árvore.
            </p>
          ) : (
            <article className="mx-auto flex min-w-0 max-w-[760px] flex-1 flex-col gap-3">
              <label htmlFor="page-title" className="sr-only">
                Título da página
              </label>
              <Input
                id="page-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  save.queue({ title: event.target.value });
                }}
                className="h-auto border-0 bg-transparent px-0 text-[28px] font-semibold tracking-[-0.02em] text-ink md:text-[34px]"
              />

              {current ? (
                <PageEditor
                  key={`${current.id}:${String(epoch)}`}
                  wsId={wsId}
                  value={(current.content as JSONContent | null) ?? null}
                  editable={canEdit}
                  searchPeople={searchPeople}
                  searchTasks={searchTasks}
                  pickImage={pickImageFile}
                  onSelect={setAnchor}
                  onChange={(content, text) => {
                    save.queue({
                      content,
                      contentText: text,
                      mentionedTaskIds: mentionedTasks(content),
                    });
                  }}
                />
              ) : (
                <Spinner label="Carregando a página" />
              )}
            </article>
          )}

          {openId !== undefined ? (
            <PageCommentsPanel
              wsId={wsId}
              pageId={openId}
              canComment={user !== null}
              anchor={anchor}
              members={members.data ?? []}
            />
          ) : null}
        </div>
      </main>

      {doc.data ? (
        <ShareDialog wsId={wsId} doc={doc.data} open={sharing} onOpenChange={setSharing} canShare />
      ) : null}

      {openId !== undefined ? (
        <VersionHistoryDialog
          wsId={wsId}
          pageId={openId}
          docId={docId}
          open={history}
          onOpenChange={setHistory}
          canRestore={canEdit}
          onRestored={() => {
            setEpoch((value) => value + 1);
          }}
          members={members.data ?? []}
        />
      ) : null}
    </div>
  );
}
