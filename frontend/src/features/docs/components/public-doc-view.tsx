import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { RichTextView } from '@/features/tasks/components/rich-text-view';
import { ThemeToggle } from '@/components/theme-toggle';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { publicDocQuery } from '../api';
import { buildPageTree, flattenTree } from '../page-tree';

/** Doc compartilhado por link: somente leitura, sem login e sem o shell do app. */
export function PublicDocView({ token }: { token: string }) {
  const doc = useQuery(publicDocQuery(token));
  const [pageId, setPageId] = useState<string | null>(null);
  const pages = doc.data?.pages ?? [];
  const rows = flattenTree(buildPageTree(pages), new Set());
  const current = pages.find((page) => page.id === pageId) ?? pages[0];

  if (doc.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner label="Carregando o Doc" />
      </div>
    );
  }

  if (doc.isError || !doc.data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-paper px-4 text-center">
        <h1 className="heading text-[20px]">Doc não encontrado</h1>
        <p className="text-[13px] text-muted">Este link público não existe mais ou foi revogado.</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="btn-signal flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold">
          &lt;/&gt;
        </span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{doc.data.doc.title}</p>
        <span className="hidden text-[12px] text-muted sm:inline">Somente leitura</span>
        <ThemeToggle />
      </header>

      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        {rows.length > 1 ? (
          <nav
            aria-label="Páginas do Doc"
            className="shrink-0 border-b border-line bg-paper-2 p-3 lg:w-[260px] lg:border-b-0 lg:border-r"
          >
            <ul className="flex flex-col gap-0.5">
              {rows.map((row) => (
                <li key={row.page.id}>
                  <button
                    type="button"
                    aria-current={row.page.id === current?.id ? 'page' : undefined}
                    onClick={() => {
                      setPageId(row.page.id);
                    }}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] md:min-h-9',
                      row.page.id === current?.id
                        ? 'bg-accent/15 font-semibold text-ink'
                        : 'text-body hover:bg-surface-2',
                    )}
                    style={{ paddingLeft: `${String(8 + row.depth * 12)}px` }}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{row.page.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
          <article className="mx-auto flex min-w-0 max-w-[760px] flex-col gap-4">
            <h1 className="heading text-[28px] md:text-[34px]">{current?.title}</h1>
            <RichTextView value={current?.content ?? null} text={current?.contentText} />
          </article>
        </main>
      </div>
    </div>
  );
}
