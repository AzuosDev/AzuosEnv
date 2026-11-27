import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { SaveWaBotSettingsInput, WaMenuKind, WaMenuOption } from '@/api/types';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { workspaceQuery } from '@/features/settings/api';
import { saveWaBotSettings, waBotSettingsQuery } from '../api';
import {
  MAX_WA_BUTTONS,
  MAX_WA_LIST_ROWS,
  WA_VARIABLES,
  maxMenuOptions,
  renderWaPreview,
} from '../whatsapp-model';
import { WaEmpty } from './wa-empty';
import {
  WaBubble,
  WaCard,
  WaField,
  WaPhonePreview,
  WaToggle,
  waGhostClass,
  waIconClass,
  waInputClass,
  waPrimaryClass,
  waTextareaClass,
} from './wa-form';

export interface BotSettingsTabProps {
  wsId: string;
}

interface Draft {
  enabled: boolean;
  welcomeMessage: string;
  handoffMessage: string;
  closingMessage: string;
  pauseMinutes: number;
  menu: {
    enabled: boolean;
    kind: WaMenuKind;
    header: string;
    body: string;
    footer: string;
    buttonLabel: string;
    options: WaMenuOption[];
  };
  ai: { enabled: boolean; knowledgeBase: string; maxAnswerChars: number };
}

/** Bolha que o cliente manda, para a prévia ter as duas pontas da conversa. */
function InboundBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="wa-tail-in relative max-w-[min(85%,22rem)] rounded-lg rounded-tl-none bg-wa-in px-2.5 py-1.5 text-[14px] leading-snug text-wa-text">
        {text}
        <span className="mt-0.5 block text-right text-[11px] text-wa-muted">11:59</span>
      </div>
    </div>
  );
}

/**
 * Aba Bot e mensagens (gestor): as mensagens automáticas do atendimento, o menu
 * e a resposta por IA, com a prévia ao vivo num celular simulado ao lado. A IA
 * só aparece com o recurso IA ligado no workspace, que é o que o backend exige.
 */
export function BotSettingsTab({ wsId }: BotSettingsTabProps) {
  const queryClient = useQueryClient();
  const query = useQuery(waBotSettingsQuery(wsId));
  const workspace = useQuery(workspaceQuery(wsId));
  const aiAllowed = workspace.data?.workspace.settings.clickApps.ai === true;
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const settings = query.data;

    if (!settings) {
      return;
    }

    setDraft({
      enabled: settings.enabled,
      welcomeMessage: settings.welcomeMessage,
      handoffMessage: settings.handoffMessage,
      closingMessage: settings.closingMessage,
      pauseMinutes: settings.pauseMinutes,
      menu: {
        enabled: settings.menu.enabled,
        kind: settings.menu.kind,
        header: settings.menu.header,
        body: settings.menu.body,
        footer: settings.menu.footer,
        buttonLabel: settings.menu.buttonLabel,
        options: settings.menu.options.map((option) => ({ ...option })),
      },
      ai: {
        enabled: settings.ai.enabled,
        knowledgeBase: settings.ai.knowledgeBase,
        maxAnswerChars: settings.ai.maxAnswerChars,
      },
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: (body: SaveWaBotSettingsInput) => saveWaBotSettings(wsId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.waBot(wsId) });
      toast.success('Bot salvo.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  if (query.isError) {
    return (
      <div className="p-3 md:p-4">
        <WaEmpty
          title="Não foi possível carregar a configuração"
          description={errorMessage(query.error)}
          icon={<AlertTriangle className="h-7 w-7" aria-hidden="true" />}
        />
      </div>
    );
  }

  if (query.isPending || !draft) {
    return (
      <div className="p-4">
        <Spinner label="Carregando o bot" />
      </div>
    );
  }

  const patch = (next: Partial<Draft>): void => {
    setDraft((current) => (current ? { ...current, ...next } : current));
  };

  const patchMenu = (next: Partial<Draft['menu']>): void => {
    setDraft((current) => (current ? { ...current, menu: { ...current.menu, ...next } } : current));
  };

  const patchAi = (next: Partial<Draft['ai']>): void => {
    setDraft((current) => (current ? { ...current, ai: { ...current.ai, ...next } } : current));
  };

  const optionLimit = maxMenuOptions(draft.menu.kind);

  const submit = (): void => {
    if (draft.menu.enabled && draft.menu.options.length === 0) {
      toast.error('O menu ligado precisa de pelo menos uma opção.');

      return;
    }

    if (draft.menu.options.length > optionLimit) {
      toast.error(
        draft.menu.kind === 'list'
          ? `A lista interativa aceita no máximo ${String(MAX_WA_LIST_ROWS)} opções.`
          : `O menu de botões aceita no máximo ${String(MAX_WA_BUTTONS)} opções.`,
      );

      return;
    }

    save.mutate({
      enabled: draft.enabled,
      welcomeMessage: draft.welcomeMessage,
      handoffMessage: draft.handoffMessage,
      closingMessage: draft.closingMessage,
      pauseMinutes: draft.pauseMinutes,
      menu: {
        enabled: draft.menu.enabled,
        kind: draft.menu.kind,
        header: draft.menu.header,
        body: draft.menu.body,
        footer: draft.menu.footer,
        buttonLabel: draft.menu.buttonLabel,
        options: draft.menu.options.map((option) => ({
          id: option.id,
          title: option.title,
          description: option.description,
        })),
      },
      ...(aiAllowed
        ? {
            ai: {
              enabled: draft.ai.enabled,
              knowledgeBase: draft.ai.knowledgeBase,
              maxAnswerChars: draft.ai.maxAnswerChars,
            },
          }
        : {}),
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <WaCard
            title="Bot do atendimento"
            hint="Desligado, nenhuma mensagem automática sai e toda conversa cai na fila."
          >
            <WaToggle
              label="Bot ligado"
              hint="Responde enquanto a conversa está com o bot e a pausa não está valendo."
              checked={draft.enabled}
              onChange={(next) => {
                patch({ enabled: next });
              }}
            />

            <WaField
              label="Minutos de pausa depois de um atendente responder"
              hint="Zero deixa o bot responder sempre, até no meio do atendimento humano."
            >
              <input
                type="number"
                min={0}
                max={1440}
                inputMode="numeric"
                value={String(draft.pauseMinutes)}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);

                  patch({
                    pauseMinutes: Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 1440),
                  });
                }}
                className={`${waInputClass} sm:w-32`}
              />
            </WaField>
          </WaCard>

          <WaCard title="Mensagens automáticas" hint="Aceitam {nome} e {numero} do contato.">
            <WaField
              label="Boas-vindas"
              hint="Primeira resposta de uma conversa nova, antes do menu."
            >
              <textarea
                rows={3}
                value={draft.welcomeMessage}
                placeholder="Oi, {nome}! Sou o atendimento da Azuos. Em que posso ajudar?"
                onChange={(event) => {
                  patch({ welcomeMessage: event.target.value });
                }}
                className={waTextareaClass}
              />
            </WaField>

            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-wa-muted">
              Variáveis:
              {WA_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => {
                    patch({ welcomeMessage: `${draft.welcomeMessage}{${variable}}` });
                  }}
                  className="rounded-full border border-wa-line px-2 py-0.5 text-[12px] font-semibold text-wa-text hover:bg-wa-header"
                >
                  {`{${variable}}`}
                </button>
              ))}
            </p>

            <WaField label="Transferência" hint="Enviada quando a conversa vai para um atendente.">
              <textarea
                rows={2}
                value={draft.handoffMessage}
                placeholder="Já estou chamando alguém da equipe para falar com você."
                onChange={(event) => {
                  patch({ handoffMessage: event.target.value });
                }}
                className={waTextareaClass}
              />
            </WaField>

            <WaField label="Encerramento" hint="Enviada quando o atendente finaliza a conversa.">
              <textarea
                rows={2}
                value={draft.closingMessage}
                placeholder="Atendimento encerrado. Se precisar, é só escrever de novo."
                onChange={(event) => {
                  patch({ closingMessage: event.target.value });
                }}
                className={waTextareaClass}
              />
            </WaField>
          </WaCard>

          <WaCard title="Menu" hint="Vai junto com as boas-vindas, como botões ou lista.">
            <WaToggle
              label="Menu ligado"
              checked={draft.menu.enabled}
              onChange={(next) => {
                patchMenu({ enabled: next });
              }}
            />

            <WaField label="Formato">
              <select
                value={draft.menu.kind}
                onChange={(event) => {
                  patchMenu({ kind: event.target.value as WaMenuKind });
                }}
                className={waInputClass}
              >
                <option value="buttons">Botões (até {MAX_WA_BUTTONS})</option>
                <option value="list">Lista (até {MAX_WA_LIST_ROWS})</option>
              </select>
            </WaField>

            <div className="grid gap-3 sm:grid-cols-2">
              <WaField label="Cabeçalho">
                <input
                  value={draft.menu.header}
                  maxLength={60}
                  onChange={(event) => {
                    patchMenu({ header: event.target.value });
                  }}
                  className={waInputClass}
                />
              </WaField>
              <WaField label="Rodapé">
                <input
                  value={draft.menu.footer}
                  maxLength={60}
                  onChange={(event) => {
                    patchMenu({ footer: event.target.value });
                  }}
                  className={waInputClass}
                />
              </WaField>
            </div>

            <WaField label="Texto do menu">
              <textarea
                rows={2}
                value={draft.menu.body}
                placeholder="Escolha por onde começar:"
                onChange={(event) => {
                  patchMenu({ body: event.target.value });
                }}
                className={waTextareaClass}
              />
            </WaField>

            {draft.menu.kind === 'list' ? (
              <WaField label="Rótulo que abre a lista">
                <input
                  value={draft.menu.buttonLabel}
                  maxLength={20}
                  onChange={(event) => {
                    patchMenu({ buttonLabel: event.target.value });
                  }}
                  className={waInputClass}
                />
              </WaField>
            ) : null}

            <div className="flex flex-col gap-2">
              {draft.menu.options.map((option, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <WaField label="Id" className="w-24 shrink-0">
                    <input
                      value={option.id}
                      onChange={(event) => {
                        patchMenu({
                          options: draft.menu.options.map((one, position) =>
                            position === index ? { ...one, id: event.target.value } : one,
                          ),
                        });
                      }}
                      className={waInputClass}
                    />
                  </WaField>

                  <WaField label="Título" className="flex-1">
                    <input
                      value={option.title}
                      maxLength={24}
                      onChange={(event) => {
                        patchMenu({
                          options: draft.menu.options.map((one, position) =>
                            position === index ? { ...one, title: event.target.value } : one,
                          ),
                        });
                      }}
                      className={waInputClass}
                    />
                  </WaField>

                  {draft.menu.kind === 'list' ? (
                    <WaField label="Descrição" className="flex-1">
                      <input
                        value={option.description}
                        maxLength={72}
                        onChange={(event) => {
                          patchMenu({
                            options: draft.menu.options.map((one, position) =>
                              position === index
                                ? { ...one, description: event.target.value }
                                : one,
                            ),
                          });
                        }}
                        className={waInputClass}
                      />
                    </WaField>
                  ) : null}

                  <button
                    type="button"
                    aria-label={`Remover a opção ${String(index + 1)}`}
                    onClick={() => {
                      patchMenu({
                        options: draft.menu.options.filter((_, position) => position !== index),
                      });
                    }}
                    className={waIconClass}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                disabled={draft.menu.options.length >= optionLimit}
                onClick={() => {
                  patchMenu({
                    options: [
                      ...draft.menu.options,
                      {
                        id: `op${String(draft.menu.options.length + 1)}`,
                        title: '',
                        description: '',
                      },
                    ],
                  });
                }}
                className={`${waGhostClass} self-start`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar opção
              </button>
            </div>
          </WaCard>

          {aiAllowed ? (
            <WaCard
              title="Resposta por IA"
              hint="Entra quando nenhuma regra casa. A IA só afirma o que está na base; fora dela, transfere."
            >
              <WaToggle
                label="IA ligada"
                checked={draft.ai.enabled}
                onChange={(next) => {
                  patchAi({ enabled: next });
                }}
              />

              <WaField
                label="Base de conhecimento"
                hint="Preço, prazo, horário, forma de pagamento: tudo que o bot pode responder."
              >
                <textarea
                  rows={6}
                  value={draft.ai.knowledgeBase}
                  maxLength={20_000}
                  onChange={(event) => {
                    patchAi({ knowledgeBase: event.target.value });
                  }}
                  className={waTextareaClass}
                />
              </WaField>

              <WaField label="Tamanho máximo da resposta (caracteres)">
                <input
                  type="number"
                  min={100}
                  max={1500}
                  inputMode="numeric"
                  value={String(draft.ai.maxAnswerChars)}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);

                    patchAi({
                      maxAnswerChars: Number.isNaN(parsed)
                        ? 600
                        : Math.min(Math.max(parsed, 100), 1500),
                    });
                  }}
                  className={`${waInputClass} sm:w-32`}
                />
              </WaField>
            </WaCard>
          ) : (
            <p className="flex items-start gap-2 rounded-2xl border border-wa-line bg-wa-panel px-4 py-3 text-[13px] text-wa-muted">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-wa-accent" aria-hidden="true" />A
              resposta por IA aparece aqui quando o recurso IA estiver ligado nas configurações do
              workspace.
            </p>
          )}

          <button
            type="button"
            disabled={save.isPending}
            onClick={submit}
            className={waPrimaryClass}
          >
            {save.isPending ? 'Salvando…' : 'Salvar bot'}
          </button>
        </div>

        <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
          <WaPhonePreview title="Prévia no celular">
            <InboundBubble text="Oi" />

            <WaBubble kind="text" text={renderWaPreview(draft.welcomeMessage)} time="12:00" />

            {draft.menu.enabled ? (
              <WaBubble
                kind={draft.menu.kind}
                text={renderWaPreview(draft.menu.body)}
                header={draft.menu.header}
                footer={draft.menu.footer}
                options={draft.menu.options}
                buttonLabel={draft.menu.buttonLabel}
                time="12:00"
              />
            ) : null}

            {draft.handoffMessage.trim() !== '' ? (
              <WaBubble kind="text" text={renderWaPreview(draft.handoffMessage)} time="12:01" />
            ) : null}

            {draft.closingMessage.trim() !== '' ? (
              <WaBubble kind="text" text={renderWaPreview(draft.closingMessage)} time="12:30" />
            ) : null}
          </WaPhonePreview>
        </div>
      </div>
    </div>
  );
}
