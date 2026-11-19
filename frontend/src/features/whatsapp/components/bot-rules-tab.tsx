import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowUp, Bot, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaBotRule } from '@/api/types';
import { queryKeys } from '@/api/keys';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { createWaBotRule, deleteWaBotRule, updateWaBotRule, waBotRulesQuery } from '../api';
import { WA_REPLY_KIND_LABEL, waRuleSummary } from '../whatsapp-model';
import { RuleEditor, type RuleDraft } from './rule-editor';
import { WaEmpty } from './wa-empty';
import { waIconClass, waPrimaryClass, WaToggle } from './wa-form';

export interface BotRulesTabProps {
  wsId: string;
}

/** Corpo que a API espera; o rascunho da tela é mais largo que o contrato. */
function bodyOf(draft: RuleDraft) {
  const interactive = draft.reply.kind === 'buttons' || draft.reply.kind === 'list';

  return {
    name: draft.name.trim(),
    trigger: { kind: draft.trigger.kind, value: draft.trigger.value.trim() },
    reply: {
      kind: draft.reply.kind,
      text: draft.reply.text,
      ...(draft.reply.kind === 'media'
        ? { mediaUrl: draft.reply.mediaUrl.trim(), filename: draft.reply.filename.trim() }
        : {}),
      ...(interactive
        ? {
            header: draft.reply.header,
            footer: draft.reply.footer,
            buttonLabel: draft.reply.buttonLabel,
            options: draft.reply.options.map((option) => ({
              id: option.id,
              title: option.title,
              description: option.description,
            })),
          }
        : {}),
    },
    actions: draft.actions,
    priority: draft.priority,
    active: draft.active,
  };
}

/**
 * Aba Regras do bot (gestor): a fila de regras da maior prioridade para a menor,
 * com liga/desliga na própria linha, e o editor gatilho → resposta → ação.
 */
export function BotRulesTab({ wsId }: BotRulesTabProps) {
  const queryClient = useQueryClient();
  const query = useQuery(waBotRulesQuery(wsId));
  const [editing, setEditing] = useState<WaBotRule | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.waBotRules(wsId) });
  };

  const save = useMutation({
    mutationFn: async (draft: RuleDraft) => {
      const body = bodyOf(draft);

      if (editing) {
        await updateWaBotRule(wsId, editing.id, body);

        return;
      }

      await createWaBotRule(wsId, body);
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      refresh();
      toast.success('Regra salva.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const patch = useMutation({
    mutationFn: ({
      rule,
      body,
    }: {
      rule: WaBotRule;
      body: { active?: boolean; priority?: number };
    }) => updateWaBotRule(wsId, rule.id, body),
    onSuccess: refresh,
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (rule: WaBotRule) => deleteWaBotRule(wsId, rule.id),
    onSuccess: () => {
      refresh();
      toast.success('Regra removida.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const rules = query.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[13px] text-wa-muted">
          A primeira regra que casa responde. Maior prioridade vence; empate vai para a mais antiga.
        </p>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className={waPrimaryClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova regra
        </button>
      </div>

      {query.isPending ? <Spinner label="Carregando as regras" /> : null}

      {query.isError ? (
        <WaEmpty
          title="Não foi possível carregar as regras"
          description={errorMessage(query.error)}
          icon={<AlertTriangle className="h-7 w-7" aria-hidden="true" />}
        />
      ) : null}

      {!query.isPending && !query.isError && rules.length === 0 ? (
        <WaEmpty
          title="Nenhuma regra ainda"
          description="Uma regra liga um gatilho a uma resposta: palavra do cliente, opção do menu ou a primeira mensagem da conversa."
          icon={<Bot className="h-7 w-7" aria-hidden="true" />}
        />
      ) : null}

      {rules.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-wa-line bg-wa-panel">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center gap-3 border-b border-wa-line px-3 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[14px] font-semibold text-wa-text">
                    {rule.name}
                  </span>
                  <span className="shrink-0 rounded-full border border-wa-line px-2 py-0.5 text-[11px] font-semibold text-wa-muted">
                    Prioridade {rule.priority}
                  </span>
                  {rule.actions.length > 0 ? (
                    <span className="shrink-0 rounded-full border border-wa-accent px-2 py-0.5 text-[11px] font-semibold text-wa-accent">
                      {rule.actions.length === 1
                        ? '1 ação'
                        : `${String(rule.actions.length)} ações`}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[13px] text-wa-muted">{waRuleSummary(rule)}</span>
                {rule.reply.kind !== 'none' && rule.reply.text.trim() !== '' ? (
                  <span className="truncate text-[12px] text-wa-muted">
                    {WA_REPLY_KIND_LABEL[rule.reply.kind]}: {rule.reply.text}
                  </span>
                ) : null}
              </span>

              <span className="w-full shrink-0 sm:w-44">
                <WaToggle
                  label={rule.active ? 'Ligada' : 'Desligada'}
                  checked={rule.active}
                  disabled={patch.isPending}
                  onChange={(next) => {
                    patch.mutate({ rule, body: { active: next } });
                  }}
                />
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Subir a prioridade de ${rule.name}`}
                  disabled={patch.isPending || rule.priority >= 1000}
                  onClick={() => {
                    patch.mutate({ rule, body: { priority: Math.min(rule.priority + 10, 1000) } });
                  }}
                  className={waIconClass}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Descer a prioridade de ${rule.name}`}
                  disabled={patch.isPending || rule.priority <= 0}
                  onClick={() => {
                    patch.mutate({ rule, body: { priority: Math.max(rule.priority - 10, 0) } });
                  }}
                  className={waIconClass}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Editar ${rule.name}`}
                  onClick={() => {
                    setEditing(rule);
                    setOpen(true);
                  }}
                  className={waIconClass}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${rule.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(rule);
                  }}
                  className={waIconClass}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <RuleEditor
        wsId={wsId}
        open={open}
        rule={editing}
        saving={save.isPending}
        onOpenChange={(next) => {
          setOpen(next);

          if (!next) {
            setEditing(null);
          }
        }}
        onSave={(draft) => {
          save.mutate(draft);
        }}
      />
    </div>
  );
}
