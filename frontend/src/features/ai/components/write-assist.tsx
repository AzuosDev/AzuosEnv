import { useMutation } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { Loader2, WandSparkles } from 'lucide-react';
import { errorMessage } from '@/api/errors';
import type { AiWriteAction } from '@/api/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { writeWithAi } from '../api';

const ACTIONS: { action: AiWriteAction; label: string }[] = [
  { action: 'improve', label: 'Melhorar' },
  { action: 'shorten', label: 'Encurtar' },
  { action: 'translate', label: 'Traduzir' },
  { action: 'fixGrammar', label: 'Corrigir' },
];

/** Trecho selecionado no editor; vazio quando o cursor não marcou nada. */
function selectionOf(editor: Editor): { from: number; to: number; text: string } {
  const { from, to } = editor.state.selection;

  return { from, to, text: editor.state.doc.textBetween(from, to, '\n').trim() };
}

/**
 * Assistente de escrita no Tiptap: melhora, encurta, traduz ou corrige o
 * trecho selecionado e troca o texto no lugar.
 */
export function WriteAssist({ wsId, editor }: { wsId: string; editor: Editor }) {
  const run = useMutation({
    mutationFn: ({ action, text }: { action: AiWriteAction; text: string }) =>
      writeWithAi(wsId, { action, text }),
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const apply = (action: AiWriteAction): void => {
    const selection = selectionOf(editor);

    if (selection.text === '') {
      toast.error('Selecione o trecho que a IA deve reescrever.');

      return;
    }

    run.mutate(
      { action, text: selection.text },
      {
        onSuccess: (result) => {
          editor
            .chain()
            .focus()
            .insertContentAt({ from: selection.from, to: selection.to }, result.text)
            .run();
        },
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Assistente de escrita"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink md:h-9 md:w-9"
      >
        {run.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <WandSparkles className="h-4 w-4" aria-hidden="true" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {ACTIONS.map((item) => (
          <DropdownMenuItem
            key={item.action}
            onSelect={() => {
              apply(item.action);
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
