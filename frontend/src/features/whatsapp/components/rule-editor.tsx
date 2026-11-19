import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  WaBotActionKind,
  WaBotReplyKind,
  WaBotRule,
  WaBotRuleActionInput,
  WaBotTrigger,
  WaMenuOption,
} from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import { membersQuery } from '@/features/settings/api';
import {
  MAX_WA_BUTTONS,
  MAX_WA_LIST_ROWS,
  WA_ACTION_KINDS,
  WA_ACTION_LABEL,
  WA_REPLY_KINDS,
  WA_REPLY_KIND_LABEL,
  WA_TRIGGERS,
  WA_TRIGGER_LABEL,
  WA_VARIABLES,
  maxMenuOptions,
  renderWaPreview,
  triggerNeedsValue,
  waRuleError,
} from '../whatsapp-model';
import { WaBubble } from './wa-form';

/** Rascunho da regra na tela; o envio converte para o corpo da API. */
export interface RuleDraft {
  name: string;
  trigger: { kind: WaBotTrigger; value: string };
  reply: {
    kind: WaBotReplyKind;
    text: string;
    mediaUrl: string;
    filename: string;
    header: string;
    footer: string;
    buttonLabel: string;
    options: WaMenuOption[];
  };
  actions: WaBotRuleActionInput[];
  priority: number;
  active: boolean;
}

export function emptyRuleDraft(): RuleDraft {
  return {
    name: '',
    trigger: { kind: 'keyword', value: '' },
    reply: {
      kind: 'text',
      text: '',
      mediaUrl: '',
      filename: '',
      header: '',
      footer: '',
      buttonLabel: 'Ver opções',
      options: [],
    },
    actions: [],
    priority: 0,
    active: true,
  };
}

export function draftOfRule(rule: WaBotRule): RuleDraft {
  return {
    name: rule.name,
    trigger: { kind: rule.trigger.kind, value: rule.trigger.value },
    reply: {
      kind: rule.reply.kind,
      text: rule.reply.text,
      mediaUrl: rule.reply.mediaUrl,
      filename: rule.reply.filename,
      header: rule.reply.header,
      footer: rule.reply.footer,
      buttonLabel: rule.reply.buttonLabel,
      options: rule.reply.options.map((option) => ({ ...option })),
    },
    actions: rule.actions.map((action) => ({
      kind: action.kind,
      ...(action.userId ? { userId: action.userId } : {}),
      ...(action.tag ? { tag: action.tag } : {}),
      priority: action.priority,
    })),
    priority: rule.priority,
    active: rule.active,
  };
}

export interface RuleEditorProps {
  wsId: string;
  open: boolean;
  /** Regra em edição; ausente é regra nova. */
  rule: WaBotRule | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: RuleDraft) => void;
}

/**
 * Editor da regra: gatilho → resposta → ação, com a prévia da bolha do lado.
 * A validação é a mesma do backend (`waRuleError`), então o erro aparece antes
 * de a chamada sair.
 */
export function RuleEditor({ wsId, open, rule, saving, onOpenChange, onSave }: RuleEditorProps) {
  const members = useQuery({ ...membersQuery(wsId), enabled: open });
  const [draft, setDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(rule ? draftOfRule(rule) : emptyRuleDraft());
      setError(null);
    }
  }, [open, rule]);

  const patch = (next: Partial<RuleDraft>): void => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const patchReply = (next: Partial<RuleDraft['reply']>): void => {
    setDraft((current) => ({ ...current, reply: { ...current.reply, ...next } }));
  };

  const interactive = draft.reply.kind === 'buttons' || draft.reply.kind === 'list';
  const optionLimit = maxMenuOptions(draft.reply.kind === 'list' ? 'list' : 'buttons');

  const addOption = (): void => {
    patchReply({
      options: [
        ...draft.reply.options,
        { id: `op${String(draft.reply.options.length + 1)}`, title: '', description: '' },
      ],
    });
  };

  const setOption = (index: number, next: Partial<WaMenuOption>): void => {
    patchReply({
      options: draft.reply.options.map((option, position) =>
        position === index ? { ...option, ...next } : option,
      ),
    });
  };

  const removeOption = (index: number): void => {
    patchReply({ options: draft.reply.options.filter((_, position) => position !== index) });
  };

  const addAction = (kind: WaBotActionKind): void => {
    patch({ actions: [...draft.actions, { kind, priority: 'high' }] });
  };

  const setAction = (index: number, next: Partial<WaBotRuleActionInput>): void => {
    patch({
      actions: draft.actions.map((action, position) =>
        position === index ? { ...action, ...next } : action,
      ),
    });
  };

  const removeAction = (index: number): void => {
    patch({ actions: draft.actions.filter((_, position) => position !== index) });
  };

  const submit = (): void => {
    const problem = waRuleError(draft);

    if (problem) {
      setError(problem);

      return;
    }

    setError(null);
    onSave(draft);
  };

  const insertVariable = (variable: string): void => {
    patchReply({ text: `${draft.reply.text}{${variable}}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="md:max-w-3xl">
        <DialogTitle className="pr-10 text-base">
          {rule ? 'Editar regra do bot' : 'Nova regra do bot'}
        </DialogTitle>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-body">Nome da regra</span>
              <Input
                value={draft.name}
                placeholder="Preço e orçamento"
                onChange={(event) => {
                  patch({ name: event.target.value });
                }}
              />
            </label>

            <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                1 · Gatilho
              </legend>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-body">Dispara quando</span>
                <SelectNative
                  value={draft.trigger.kind}
                  onChange={(event) => {
                    patch({
                      trigger: {
                        kind: event.target.value as WaBotTrigger,
                        value: draft.trigger.value,
                      },
                    });
                  }}
                >
                  {WA_TRIGGERS.map((kind) => (
                    <option key={kind} value={kind}>
                      {WA_TRIGGER_LABEL[kind]}
                    </option>
                  ))}
                </SelectNative>
              </label>

              {triggerNeedsValue(draft.trigger.kind) ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-body">
                    {draft.trigger.kind === 'regex'
                      ? 'Expressão'
                      : draft.trigger.kind === 'menuOption'
                        ? 'Id da opção'
                        : 'Valor'}
                  </span>
                  <Input
                    value={draft.trigger.value}
                    placeholder={draft.trigger.kind === 'regex' ? '^(oi|ola)' : 'preço'}
                    onChange={(event) => {
                      patch({
                        trigger: { kind: draft.trigger.kind, value: event.target.value },
                      });
                    }}
                  />
                </label>
              ) : (
                <p className="text-[12px] text-muted">
                  {draft.trigger.kind === 'firstMessage'
                    ? 'Vale na primeira mensagem de uma conversa nova.'
                    : 'Vale quando a mensagem chega fora do horário de atendimento.'}
                </p>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                2 · Resposta
              </legend>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-body">Formato</span>
                <SelectNative
                  value={draft.reply.kind}
                  onChange={(event) => {
                    patchReply({ kind: event.target.value as WaBotReplyKind });
                  }}
                >
                  {WA_REPLY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {WA_REPLY_KIND_LABEL[kind]}
                    </option>
                  ))}
                </SelectNative>
              </label>

              {draft.reply.kind !== 'none' ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-body">
                    {draft.reply.kind === 'media' ? 'Legenda' : 'Mensagem'}
                  </span>
                  <Textarea
                    rows={3}
                    value={draft.reply.text}
                    placeholder="Oi, {nome}! Nosso orçamento sai em até um dia útil."
                    onChange={(event) => {
                      patchReply({ text: event.target.value });
                    }}
                  />
                  <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    Variáveis:
                    {WA_VARIABLES.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => {
                          insertVariable(variable);
                        }}
                        className="rounded-full border border-line px-2 py-0.5 text-[12px] font-semibold text-body hover:bg-surface-2 hover:text-ink"
                      >
                        {`{${variable}}`}
                      </button>
                    ))}
                  </span>
                </label>
              ) : null}

              {draft.reply.kind === 'media' ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-body">Link do arquivo</span>
                    <Input
                      value={draft.reply.mediaUrl}
                      placeholder="https://…/tabela.pdf"
                      onChange={(event) => {
                        patchReply({ mediaUrl: event.target.value });
                      }}
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-body">Nome do arquivo</span>
                    <Input
                      value={draft.reply.filename}
                      placeholder="tabela.pdf"
                      onChange={(event) => {
                        patchReply({ filename: event.target.value });
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {interactive ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-body">Cabeçalho</span>
                      <Input
                        value={draft.reply.header}
                        onChange={(event) => {
                          patchReply({ header: event.target.value });
                        }}
                      />
                    </label>
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-body">Rodapé</span>
                      <Input
                        value={draft.reply.footer}
                        onChange={(event) => {
                          patchReply({ footer: event.target.value });
                        }}
                      />
                    </label>
                  </div>

                  {draft.reply.kind === 'list' ? (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-body">
                        Rótulo que abre a lista
                      </span>
                      <Input
                        value={draft.reply.buttonLabel}
                        onChange={(event) => {
                          patchReply({ buttonLabel: event.target.value });
                        }}
                      />
                    </label>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    {draft.reply.options.map((option, index) => (
                      <div key={index} className="flex flex-wrap items-end gap-2">
                        <label className="flex w-24 shrink-0 flex-col gap-1.5">
                          <span className="text-[12px] font-medium text-body">Id</span>
                          <Input
                            value={option.id}
                            onChange={(event) => {
                              setOption(index, { id: event.target.value });
                            }}
                          />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="text-[12px] font-medium text-body">Título</span>
                          <Input
                            value={option.title}
                            maxLength={24}
                            onChange={(event) => {
                              setOption(index, { title: event.target.value });
                            }}
                          />
                        </label>
                        {draft.reply.kind === 'list' ? (
                          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="text-[12px] font-medium text-body">Descrição</span>
                            <Input
                              value={option.description}
                              maxLength={72}
                              onChange={(event) => {
                                setOption(index, { description: event.target.value });
                              }}
                            />
                          </label>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover a opção ${String(index + 1)}`}
                          onClick={() => {
                            removeOption(index);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={draft.reply.options.length >= optionLimit}
                      onClick={addOption}
                      className="self-start"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Adicionar opção
                    </Button>

                    <p className="text-[12px] text-muted">
                      {draft.reply.kind === 'list'
                        ? `A lista aceita até ${String(MAX_WA_LIST_ROWS)} linhas.`
                        : `O menu aceita até ${String(MAX_WA_BUTTONS)} botões.`}
                    </p>
                  </div>
                </>
              ) : null}
            </fieldset>

            <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                3 · Ações
              </legend>

              {draft.actions.length === 0 ? (
                <p className="text-[12px] text-muted">
                  Sem ação a regra só responde. Com ação ela também muda a conversa.
                </p>
              ) : null}

              {draft.actions.map((action, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <span className="flex min-h-11 min-w-0 flex-1 items-center text-[13px] text-ink md:min-h-10">
                    {WA_ACTION_LABEL[action.kind]}
                  </span>

                  {action.kind === 'assign' ? (
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-body">Responsável</span>
                      <SelectNative
                        value={action.userId ?? ''}
                        onChange={(event) => {
                          setAction(index, { userId: event.target.value });
                        }}
                      >
                        <option value="">Escolha quem recebe</option>
                        {(members.data ?? []).map((member) => (
                          <option key={member.userId.id} value={member.userId.id}>
                            {member.userId.name || member.userId.email}
                          </option>
                        ))}
                      </SelectNative>
                    </label>
                  ) : null}

                  {action.kind === 'tag' ? (
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-body">Etiqueta</span>
                      <Input
                        value={action.tag ?? ''}
                        onChange={(event) => {
                          setAction(index, { tag: event.target.value });
                        }}
                      />
                    </label>
                  ) : null}

                  {action.kind === 'priority' ? (
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-body">Prioridade</span>
                      <SelectNative
                        value={action.priority ?? 'high'}
                        onChange={(event) => {
                          setAction(index, {
                            priority: event.target.value as 'normal' | 'high' | 'urgent',
                          });
                        }}
                      >
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </SelectNative>
                    </label>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover a ação ${WA_ACTION_LABEL[action.kind]}`}
                    onClick={() => {
                      removeAction(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-body">Adicionar ação</span>
                <SelectNative
                  value=""
                  disabled={draft.actions.length >= 6}
                  onChange={(event) => {
                    if (event.target.value !== '') {
                      addAction(event.target.value as WaBotActionKind);
                    }
                  }}
                >
                  <option value="">Escolha uma ação</option>
                  {WA_ACTION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {WA_ACTION_LABEL[kind]}
                    </option>
                  ))}
                </SelectNative>
              </label>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <label className="flex w-28 flex-col gap-1.5">
                <span className="text-[13px] font-medium text-body">Prioridade</span>
                <Input
                  value={String(draft.priority)}
                  inputMode="numeric"
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);

                    patch({
                      priority: Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 1000),
                    });
                  }}
                />
              </label>

              <label className="flex min-h-11 items-center gap-2 self-end text-[13px] text-body">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) => {
                    patch({ active: event.target.checked });
                  }}
                  className="h-4 w-4 accent-accent"
                />
                Regra ligada
              </label>
            </div>
          </div>

          <div data-module="whatsapp" className="min-w-0">
            <section
              aria-label="Prévia da resposta"
              className="wa-doodle flex flex-col gap-2 rounded-2xl border border-wa-line p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-wa-muted">
                Prévia
              </p>
              <WaBubble
                kind={draft.reply.kind}
                text={renderWaPreview(draft.reply.text)}
                header={draft.reply.header}
                footer={draft.reply.footer}
                options={draft.reply.options}
                buttonLabel={draft.reply.buttonLabel}
                filename={draft.reply.filename}
              />
            </section>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? 'Salvando…' : 'Salvar regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
