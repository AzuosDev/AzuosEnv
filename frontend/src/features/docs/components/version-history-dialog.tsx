import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { pageVersionsQuery, restorePageVersion } from '../api';

export interface VersionHistoryDialogProps {
  wsId: string;
  pageId: string;
  docId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
  /** Avisa a tela para remontar o editor com o conteúdo restaurado. */
  onRestored: () => void;
  members: WorkspaceMemberItem[];
}

/** Histórico de versões da página: prévia do texto e restaurar. */
export function VersionHistoryDialog({
  wsId,
  pageId,
  docId,
  open,
  onOpenChange,
  canRestore,
  onRestored,
  members,
}: VersionHistoryDialogProps) {
  const client = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const versions = useQuery({ ...pageVersionsQuery(wsId, pageId), enabled: open });
  const items = versions.data ?? [];
  const current = items.find((item) => item.id === picked) ?? items[0];

  const restore = useMutation({
    mutationFn: (versionId: string) => restorePageVersion(wsId, pageId, versionId),
    onSuccess: async (page) => {
      client.setQueryData(queryKeys.docPage(wsId, pageId), page);
      await client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });
      await client.invalidateQueries({ queryKey: queryKeys.pageVersions(wsId, pageId) });
      onRestored();
      toast.success('Versão restaurada.');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de versões</DialogTitle>
        </DialogHeader>

        {versions.isPending ? <p className="text-[13px] text-muted">Carregando…</p> : null}

        {!versions.isPending && items.length === 0 ? (
          <p className="text-[13px] text-muted">Esta página ainda não tem versões guardadas.</p>
        ) : null}

        {items.length > 0 ? (
          <div className="flex min-h-0 flex-col gap-4 md:flex-row">
            <ul
              aria-label="Versões da página"
              className="flex max-h-48 shrink-0 flex-col gap-1 overflow-y-auto md:max-h-80 md:w-56"
            >
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={item.id === current?.id ? 'true' : undefined}
                    onClick={() => {
                      setPicked(item.id);
                    }}
                    className={cn(
                      'flex min-h-11 w-full flex-col items-start rounded-lg px-2 py-1 text-left text-[12.5px] md:min-h-10',
                      item.id === current?.id
                        ? 'bg-accent/15 text-ink'
                        : 'text-body hover:bg-surface-2',
                    )}
                  >
                    <span className="font-semibold">Versão {item.version}</span>
                    <span className="text-muted">
                      {format(new Date(item.createdAt), "d 'de' MMM, HH:mm", { locale: ptBR })} ·{' '}
                      {members.find((member) => member.userId.id === String(item.createdBy))?.userId
                        .name ?? 'Alguém'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-3">
              <p className="mb-2 text-[13px] font-semibold text-ink">{current?.title}</p>
              <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-[12.5px] text-body">
                {current?.contentText === '' ? 'Sem texto nesta versão.' : current?.contentText}
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Fechar
          </Button>

          {canRestore && current ? (
            <Button
              disabled={restore.isPending}
              onClick={() => {
                restore.mutate(current.id);
              }}
            >
              Restaurar esta versão
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
