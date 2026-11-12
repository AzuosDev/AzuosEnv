import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BookOpen, FileText, Globe, Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import type { DocHubTab, WorkspaceDoc } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { docsQuery } from '../api';
import { NewDocDialog } from './new-doc-dialog';

const TABS: { value: DocHubTab; label: string }[] = [
  { value: 'recent', label: 'Recentes' },
  { value: 'favorites', label: 'Favoritos' },
  { value: 'mine', label: 'Meus' },
  { value: 'all', label: 'Todos' },
];

function DocCard({ doc, onOpen }: { doc: WorkspaceDoc; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-left hover:border-scene-line hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          {doc.isWiki ? (
            <BookOpen className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {doc.title}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span>
            Editado{' '}
            {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: ptBR })}
          </span>
          {doc.isWiki ? <span className="text-accent">wiki</span> : null}
          {doc.private ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" /> privado
            </span>
          ) : null}
          {doc.share.public ? (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" aria-hidden="true" /> link público
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** Hub de Docs: abas Recentes, Favoritos, Meus e Todos, com o Doc novo. */
export function DocsHub({ wsId }: { wsId: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DocHubTab>('recent');
  const [creating, setCreating] = useState(false);
  const docs = useQuery(docsQuery(wsId, { tab }));
  const items = docs.data ?? [];

  const open = (docId: string): void => {
    void navigate({ to: '/w/$wsId/docs/$docId', params: { wsId, docId } });
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="heading min-w-0 flex-1 text-[22px]">Docs</h1>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Novo Doc
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as DocHubTab);
        }}
      >
        <TabsList>
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="flex min-h-0 flex-col gap-3">
          {docs.isPending ? <Spinner label="Carregando Docs" /> : null}

          {!docs.isPending && items.length === 0 ? (
            <EmptyState
              title="Nenhum Doc por aqui"
              description="Crie o primeiro Doc deste workspace para reunir processos, escopos e modelos."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreating(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Novo Doc
                </Button>
              }
            />
          ) : null}

          {items.length > 0 ? (
            <ul className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
              {items.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => {
                    open(doc.id);
                  }}
                />
              ))}
            </ul>
          ) : null}
        </TabsContent>
      </Tabs>

      <NewDocDialog
        wsId={wsId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(doc) => {
          open(doc.id);
        }}
      />
    </div>
  );
}
