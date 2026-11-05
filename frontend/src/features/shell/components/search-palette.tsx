import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

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

/**
 * Busca da topbar. O palette abre vazio: a busca de verdade (tarefas, Docs,
 * mensagens) entra na etapa do Inbox e da busca global.
 */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');

  usePaletteShortcut(setOpen);

  return (
    <>
      <button
        type="button"
        aria-label="Buscar"
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3">
          <DialogTitle className="heading text-base">Buscar</DialogTitle>
          <DialogDescription className="text-[13px] text-muted">
            Procure tarefas, Docs, mensagens e pessoas do workspace.
          </DialogDescription>
          <Input
            autoFocus
            type="search"
            aria-label="Termo da busca"
            placeholder="Buscar tarefas, IDs…"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
          />
          <EmptyState
            className="min-h-40"
            title="A busca entra em breve"
            description="O resultado da busca global chega na etapa do Inbox e da busca."
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
