import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { AiSummarizeEntityType } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { summarize } from '../api';
import { AiMarkdown } from './ai-markdown';

const TITLE: Record<AiSummarizeEntityType, string> = {
  task: 'Resumo da tarefa',
  thread: 'Resumo da thread',
  channel: 'Resumo do canal',
  doc: 'Resumo do Doc',
};

export interface SummarizeButtonProps {
  wsId: string;
  entityType: AiSummarizeEntityType;
  /** Id da tarefa, da mensagem raiz, do canal ou do Doc. */
  id: string;
  /** Botão só de ícone quando o espaço é apertado (cabeçalho da thread). */
  iconOnly?: boolean;
  className?: string;
}

/** Botão Resumir: chama a IA e mostra o resumo em markdown num diálogo. */
export function SummarizeButton({
  wsId,
  entityType,
  id,
  iconOnly = false,
  className,
}: SummarizeButtonProps) {
  const [open, setOpen] = useState(false);
  const run = useMutation({
    mutationFn: () => summarize(wsId, { entityType, id }),
  });

  return (
    <>
      <Button
        variant="ghost"
        size={iconOnly ? 'icon' : 'sm'}
        aria-label="Resumir com IA"
        className={className}
        onClick={() => {
          setOpen(true);
          run.mutate();
        }}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {iconOnly ? null : 'Resumir'}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);

          if (!next) {
            run.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TITLE[entityType]}</DialogTitle>
          </DialogHeader>

          {run.isPending ? <Spinner label="A IA está resumindo" /> : null}

          {run.isError ? (
            <p role="alert" className="text-[13px] text-danger">
              {errorMessage(run.error)}
            </p>
          ) : null}

          {run.data ? <AiMarkdown text={run.data.summary} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
