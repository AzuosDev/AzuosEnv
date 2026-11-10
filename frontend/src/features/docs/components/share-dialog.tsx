import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { WorkspaceDoc } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { shareDoc } from '../api';

export interface ShareDialogProps {
  wsId: string;
  doc: WorkspaceDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canShare: boolean;
}

/**
 * Compartilhar o Doc por link público. O token só volta na criação, então a URL
 * é guardada no estado da tela enquanto o diálogo está aberto.
 */
export function ShareDialog({ wsId, doc, open, onOpenChange, canShare }: ShareDialogProps) {
  const client = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);

  const share = useMutation({
    mutationFn: (isPublic: boolean) => shareDoc(wsId, doc.id, isPublic),
    onSuccess: async (result) => {
      // A API devolve a URL dela; a página pública do app é /p/doc/:token.
      setUrl(result.token === null ? null : `${window.location.origin}/p/doc/${result.token}`);
      client.setQueryData(queryKeys.doc(wsId, doc.id), result.doc);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'docs'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const isPublic = doc.share.public;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar “{doc.title}”</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="doc-public" className="text-[13px]">
            Link público somente leitura
          </Label>
          <Switch
            id="doc-public"
            checked={isPublic}
            disabled={!canShare || share.isPending}
            onCheckedChange={(checked) => {
              share.mutate(checked);
            }}
          />
        </div>

        <p className="text-[12.5px] text-muted">
          Com o link público, qualquer pessoa com a URL lê o Doc sem entrar na conta.
        </p>

        {isPublic ? (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Label htmlFor="doc-url">Endereço público</Label>
              <Input
                id="doc-url"
                readOnly
                value={url ?? 'Gere um link novo para ver o endereço.'}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar link público"
              disabled={url === null}
              onClick={() => {
                if (url !== null) {
                  void navigator.clipboard.writeText(url);
                  toast.success('Link copiado.');
                }
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          {isPublic && canShare ? (
            <Button
              variant="ghost"
              disabled={share.isPending}
              onClick={() => {
                share.mutate(true);
              }}
            >
              Gerar link novo
            </Button>
          ) : null}

          <Button
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
