import { Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAiChat } from '../hooks/use-ai-chat';
import { AiChatView } from './ai-chat';

/** Gaveta de IA da topbar: a mesma conversa, disponível em qualquer tela. */
export function AiDrawer({ wsId }: { wsId: string }) {
  const [open, setOpen] = useState(false);
  const chat = useAiChat(wsId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir IA"
        title="IA"
        className="shrink-0"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-3 bg-paper p-3 sm:max-w-md md:max-w-lg"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-2 pr-10">
            <SheetTitle className="heading flex-1 text-[17px]">IA</SheetTitle>
            <Button variant="ghost" size="sm" onClick={chat.startNew}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Nova
            </Button>
          </div>

          <AiChatView wsId={wsId} chat={chat} compact />
        </SheetContent>
      </Sheet>
    </>
  );
}
