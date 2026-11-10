import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { TemplateType } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { createTemplate } from '../api';
import { TEMPLATE_TYPE_LABEL } from '../template-fields';

export interface SaveTemplateDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recurso que vira o snapshot. */
  source: { type: TemplateType; id: string; name: string } | null;
}

/** "Salvar como template": nome do template e o recurso de origem. */
export function SaveTemplateDialog({ wsId, open, onOpenChange, source }: SaveTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open && source) {
      setName(source.name);
    }
  }, [open, source]);

  const save = useMutation({
    mutationFn: () => {
      if (!source) {
        throw new Error('Sem recurso de origem.');
      }

      return createTemplate(wsId, {
        type: source.type,
        name: name.trim(),
        sourceId: source.id,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'templates'] });
      toast.success('Template salvo.');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar como template</DialogTitle>
          <DialogDescription>
            {source
              ? `O ${TEMPLATE_TYPE_LABEL[source.type]} "${source.name}" vira um template reaplicável, com as datas guardadas como deslocamento.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {save.isError ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-name">Nome do template</Label>
          <Input
            id="template-name"
            autoFocus
            maxLength={160}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={name.trim() === '' || save.isPending}
            onClick={() => {
              save.mutate();
            }}
          >
            {save.isPending ? <Spinner label="Salvando" /> : 'Salvar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
