import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Bot, ListPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { workspaceQuery } from '@/features/settings/api';
import { useMinWidth } from '@/lib/use-min-width';
import { cn } from '@/lib/utils';
import { aiUsageQuery } from '../api';
import { DRAFT_ID } from '../conversations';
import { useAiChat } from '../hooks/use-ai-chat';
import { AgentsDialog } from './agents-dialog';
import { AiChatView } from './ai-chat';
import { TasksFromTextDialog } from './tasks-from-text-dialog';

/** Acima disso a lista de conversas fica fixa ao lado da conversa. */
const WIDE_PX = 1024;

function usageText(total: number, budget: number): string {
  const used = new Intl.NumberFormat('pt-BR').format(total);

  if (budget === 0) {
    return `${used} tokens este mês`;
  }

  const percent = Math.min(100, Math.round((total / budget) * 100));

  return `${used} de ${new Intl.NumberFormat('pt-BR').format(budget)} tokens (${String(percent)}%)`;
}

/** Tela da IA: conversas, conversa em streaming e os atalhos do módulo. */
export function AiPage({ wsId }: { wsId: string }) {
  const { data: workspace } = useSuspenseQuery(workspaceQuery(wsId));
  const usage = useQuery(aiUsageQuery(wsId));
  const chat = useAiChat(wsId);
  const wide = useMinWidth(WIDE_PX);
  const [agents, setAgents] = useState(false);
  const [fromText, setFromText] = useState(false);

  const canManage = workspace.role === 'owner' || workspace.role === 'admin';
  const history = chat.conversations.filter((item) => item.id !== DRAFT_ID);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {wide ? (
        <aside
          aria-label="Conversas da IA"
          className="flex w-[260px] shrink-0 flex-col gap-3 border-r border-line bg-paper-2 p-3"
        >
          <div className="flex items-center gap-2 px-1">
            <h1 className="heading flex-1 text-[20px]">IA</h1>
          </div>

          <Button size="sm" onClick={chat.startNew}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Nova conversa
          </Button>

          <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Recentes
          </p>

          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {history.length === 0 ? (
              <li className="px-1 text-[12px] text-muted">Nenhuma conversa ainda.</li>
            ) : null}

            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.id === chat.conversation.id ? 'page' : undefined}
                  className={cn(
                    'h-10 w-full truncate rounded-lg px-2.5 text-left text-[13px]',
                    item.id === chat.conversation.id
                      ? 'bg-accent/15 text-ink'
                      : 'text-body hover:bg-surface-2 hover:text-ink',
                  )}
                  onClick={() => {
                    chat.openConversation(item.id);
                  }}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromText(true);
              }}
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" /> Texto em tarefas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAgents(true);
              }}
            >
              <Bot className="h-4 w-4" aria-hidden="true" /> Agentes
            </Button>
            <p className="px-1 text-[12px] text-muted">
              {usage.data ? usageText(usage.data.total, usage.data.budget) : 'Uso do mês…'}
            </p>
          </div>
        </aside>
      ) : null}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2 md:px-6">
          {wide ? null : <h1 className="heading flex-1 text-[18px]">IA</h1>}
          <span className="hidden flex-1 text-[13px] text-muted lg:inline">
            Contexto: {workspace.workspace.name} · tarefas, docs e chat
          </span>

          {wide ? null : (
            <>
              <Button variant="ghost" size="sm" onClick={chat.startNew}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Nova
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Criar tarefas a partir de texto"
                onClick={() => {
                  setFromText(true);
                }}
              >
                <ListPlus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Agentes de IA"
                onClick={() => {
                  setAgents(true);
                }}
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </header>

        <AiChatView wsId={wsId} chat={chat} />
      </main>

      <AgentsDialog wsId={wsId} open={agents} onOpenChange={setAgents} canManage={canManage} />
      <TasksFromTextDialog wsId={wsId} open={fromText} onOpenChange={setFromText} />
    </div>
  );
}
