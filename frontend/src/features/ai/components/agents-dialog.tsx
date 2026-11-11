import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { AiAgent, AiAgentType, CreateAiAgentInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { aiAgentsQuery, createAiAgent, deleteAiAgent, updateAiAgent } from '../api';
import { AGENT_TYPE_HINT, AGENT_TYPE_LABEL, cronToText, SCHEDULE_PRESETS } from '../cron-text';

const TYPES: AiAgentType[] = ['dailySummary', 'overdueDigest', 'bugTriage'];

export interface AgentsDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Só admin e dono criam, mudam e removem agentes. */
  canManage: boolean;
}

/** Agentes agendados: ligar, desligar, trocar a agenda e criar. */
export function AgentsDialog({ wsId, open, onOpenChange, canManage }: AgentsDialogProps) {
  const client = useQueryClient();
  const agents = useQuery({ ...aiAgentsQuery(wsId), enabled: open });
  const [name, setName] = useState('');
  const [type, setType] = useState<AiAgentType>('dailySummary');
  const [cron, setCron] = useState(SCHEDULE_PRESETS[0]?.value ?? '0 8 * * *');

  const refresh = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: queryKeys.aiAgents(wsId) });
  };

  const create = useMutation({
    mutationFn: (body: CreateAiAgentInput) => createAiAgent(wsId, body),
    onSuccess: async () => {
      setName('');
      toast.success('Agente criado.');
      await refresh();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const patch = useMutation({
    mutationFn: ({ agent, body }: { agent: AiAgent; body: { active?: boolean; cron?: string } }) =>
      updateAiAgent(wsId, agent.id, body),
    onSuccess: refresh,
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (agent: AiAgent) => deleteAiAgent(wsId, agent.id),
    onSuccess: async () => {
      toast.success('Agente removido.');
      await refresh();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const items = agents.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Agentes de IA</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {agents.isPending ? <Spinner label="Carregando agentes" /> : null}

          {!agents.isPending && items.length === 0 ? (
            <p className="text-[13px] text-muted">
              Nenhum agente ainda. Crie um para a IA avisar sozinha no horário certo.
            </p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {items.map((agent) => (
              <li
                key={agent.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">{agent.name}</p>
                  <p className="text-[12px] text-muted">
                    {AGENT_TYPE_LABEL[agent.type]} · {cronToText(agent.cron)}
                  </p>
                </div>

                {canManage ? (
                  <SelectNative
                    aria-label={`Agenda de ${agent.name}`}
                    className="w-auto"
                    value={agent.cron}
                    onChange={(event) => {
                      patch.mutate({ agent, body: { cron: event.target.value } });
                    }}
                  >
                    {SCHEDULE_PRESETS.some((preset) => preset.value === agent.cron) ? null : (
                      <option value={agent.cron}>{cronToText(agent.cron)}</option>
                    )}
                    {SCHEDULE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </SelectNative>
                ) : null}

                <Switch
                  aria-label={`Ligar ${agent.name}`}
                  checked={agent.active}
                  disabled={!canManage || patch.isPending}
                  onCheckedChange={(checked) => {
                    patch.mutate({ agent, body: { active: checked } });
                  }}
                />

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${agent.name}`}
                    onClick={() => {
                      remove.mutate(agent);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          {canManage ? (
            <form
              className="flex flex-col gap-3 rounded-xl border border-line bg-paper-2 p-3"
              onSubmit={(event) => {
                event.preventDefault();

                if (name.trim() === '') {
                  return;
                }

                create.mutate({ name: name.trim(), type, cron, active: true });
              }}
            >
              <p className="text-[13px] font-semibold text-ink">Novo agente</p>

              <div>
                <Label htmlFor="agent-name">Nome</Label>
                <Input
                  id="agent-name"
                  value={name}
                  placeholder="Resumo diário"
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="agent-type">O que ele faz</Label>
                <SelectNative
                  id="agent-type"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as AiAgentType);
                  }}
                >
                  {TYPES.map((value) => (
                    <option key={value} value={value}>
                      {AGENT_TYPE_LABEL[value]}
                    </option>
                  ))}
                </SelectNative>
                <p className="mt-1 text-[12px] text-muted">{AGENT_TYPE_HINT[type]}</p>
              </div>

              <div>
                <Label htmlFor="agent-cron">Quando</Label>
                <SelectNative
                  id="agent-cron"
                  value={cron}
                  onChange={(event) => {
                    setCron(event.target.value);
                  }}
                >
                  {SCHEDULE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </SelectNative>
              </div>

              <Button type="submit" size="sm" disabled={name.trim() === '' || create.isPending}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Criar agente
              </Button>
            </form>
          ) : (
            <p className="text-[12px] text-muted">Só um admin liga, desliga ou cria agentes.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
