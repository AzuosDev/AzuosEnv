import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { SaveWaBotSettingsInput, WaHoliday, WaHoursDay } from '@/api/types';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { workspaceQuery } from '@/features/settings/api';
import { saveWaBotSettings, waBotSettingsQuery } from '../api';
import { WA_WEEKDAYS, hoursError, renderWaPreview, usedHoursDays } from '../whatsapp-model';
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

export interface HoursTabProps {
  wsId: string;
}

interface Draft {
  enabled: boolean;
  timezone: string;
  days: WaHoursDay[];
  holidays: WaHoliday[];
  awayMessage: string;
}

/** Todos os sete dias na tela, mesmo os fechados; fechado é dia sem faixa. */
function allWeek(days: WaHoursDay[]): WaHoursDay[] {
  return WA_WEEKDAYS.map((weekday) => {
    const found = days.find((day) => day.weekday === weekday.weekday);

    return {
      weekday: weekday.weekday,
      ranges: (found?.ranges ?? []).map((range) => ({ start: range.start, end: range.end })),
    };
  });
}

/**
 * Aba Horários (gestor): dias, faixas, feriados e a mensagem de ausência. Com o
 * horário ligado, a mensagem que chega fora dele recebe a ausência em vez do
 * fluxo normal do bot — por isso a prévia mostra justamente esse caso.
 */
export function HoursTab({ wsId }: HoursTabProps) {
  const queryClient = useQueryClient();
  const query = useQuery(waBotSettingsQuery(wsId));
  const workspace = useQuery(workspaceQuery(wsId));
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const settings = query.data;

    if (!settings) {
      return;
    }

    setDraft({
      enabled: settings.hours.enabled,
      timezone: settings.hours.timezone,
      days: allWeek(settings.hours.days),
      holidays: settings.hours.holidays.map((holiday) => ({ ...holiday })),
      awayMessage: settings.hours.awayMessage,
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: (body: SaveWaBotSettingsInput) => saveWaBotSettings(wsId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.waBot(wsId) });
      toast.success('Horários salvos.');
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
        <Spinner label="Carregando os horários" />
      </div>
    );
  }

  const patch = (next: Partial<Draft>): void => {
    setDraft((current) => (current ? { ...current, ...next } : current));
  };

  const setRange = (
    weekday: number,
    index: number,
    next: { start?: string; end?: string },
  ): void => {
    patch({
      days: draft.days.map((day) =>
        day.weekday === weekday
          ? {
              weekday,
              ranges: day.ranges.map((range, position) =>
                position === index ? { ...range, ...next } : range,
              ),
            }
          : day,
      ),
    });
  };

  const addRange = (weekday: number): void => {
    patch({
      days: draft.days.map((day) =>
        day.weekday === weekday
          ? { weekday, ranges: [...day.ranges, { start: '09:00', end: '18:00' }] }
          : day,
      ),
    });
  };

  const removeRange = (weekday: number, index: number): void => {
    patch({
      days: draft.days.map((day) =>
        day.weekday === weekday
          ? { weekday, ranges: day.ranges.filter((_, position) => position !== index) }
          : day,
      ),
    });
  };

  const submit = (): void => {
    const problem = hoursError(draft.days);

    if (problem) {
      toast.error(problem);

      return;
    }

    const bad = draft.holidays.find((holiday) => !/^\d{4}-\d{2}-\d{2}$/.test(holiday.date));

    if (bad) {
      toast.error('Confira as datas dos feriados.');

      return;
    }

    save.mutate({
      pauseMinutes: query.data?.pauseMinutes ?? 30,
      hours: {
        enabled: draft.enabled,
        timezone: draft.timezone.trim(),
        days: usedHoursDays(draft.days),
        holidays: draft.holidays.map((holiday) => ({
          date: holiday.date,
          name: holiday.name,
        })),
        awayMessage: draft.awayMessage,
      },
    });
  };

  const fallbackZone = workspace.data?.workspace.timezone ?? '';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <WaCard
            title="Horário de atendimento"
            hint="Desligado, o bot responde a qualquer hora e a ausência nunca sai."
          >
            <WaToggle
              label="Horário ligado"
              checked={draft.enabled}
              onChange={(next) => {
                patch({ enabled: next });
              }}
            />

            <WaField
              label="Fuso do atendimento"
              hint={
                fallbackZone === ''
                  ? 'Vazio usa o fuso do workspace.'
                  : `Vazio usa o fuso do workspace (${fallbackZone}).`
              }
            >
              <input
                value={draft.timezone}
                placeholder={fallbackZone || 'America/Sao_Paulo'}
                onChange={(event) => {
                  patch({ timezone: event.target.value });
                }}
                className={waInputClass}
              />
            </WaField>
          </WaCard>

          <WaCard title="Dias e faixas" hint="Dia sem faixa é dia fechado.">
            <ul className="flex flex-col">
              {draft.days.map((day) => {
                const label = WA_WEEKDAYS.find((one) => one.weekday === day.weekday)?.label ?? '';

                return (
                  <li
                    key={day.weekday}
                    className="flex flex-col gap-2 border-b border-wa-line py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-3"
                  >
                    <span className="shrink-0 text-[13px] font-semibold text-wa-text sm:w-20 sm:pt-2.5">
                      {label}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      {day.ranges.length === 0 ? (
                        <span className="text-[13px] text-wa-muted sm:pt-2.5">Fechado</span>
                      ) : null}

                      {day.ranges.map((range, index) => (
                        <span key={index} className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5">
                            <span className="sr-only">{`Abre ${label}, faixa ${String(index + 1)}`}</span>
                            <input
                              type="time"
                              value={range.start}
                              onChange={(event) => {
                                setRange(day.weekday, index, { start: event.target.value });
                              }}
                              className={`${waInputClass} w-28`}
                            />
                          </label>

                          <span aria-hidden="true" className="text-[13px] text-wa-muted">
                            às
                          </span>

                          <label className="flex items-center gap-1.5">
                            <span className="sr-only">{`Fecha ${label}, faixa ${String(index + 1)}`}</span>
                            <input
                              type="time"
                              value={range.end}
                              onChange={(event) => {
                                setRange(day.weekday, index, { end: event.target.value });
                              }}
                              className={`${waInputClass} w-28`}
                            />
                          </label>

                          <button
                            type="button"
                            aria-label={`Remover a faixa ${String(index + 1)} de ${label}`}
                            onClick={() => {
                              removeRange(day.weekday, index);
                            }}
                            className={waIconClass}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </span>
                      ))}

                      <button
                        type="button"
                        disabled={day.ranges.length >= 6}
                        onClick={() => {
                          addRange(day.weekday);
                        }}
                        className={`${waGhostClass} self-start`}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Adicionar faixa
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </WaCard>

          <WaCard title="Feriados" hint="O dia inteiro fica fechado na data marcada.">
            {draft.holidays.length === 0 ? (
              <p className="text-[13px] text-wa-muted">Nenhum feriado cadastrado.</p>
            ) : null}

            {draft.holidays.map((holiday, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <WaField label="Data" className="w-40 shrink-0">
                  <input
                    type="date"
                    value={holiday.date}
                    onChange={(event) => {
                      patch({
                        holidays: draft.holidays.map((one, position) =>
                          position === index ? { ...one, date: event.target.value } : one,
                        ),
                      });
                    }}
                    className={waInputClass}
                  />
                </WaField>

                <WaField label="Nome" className="flex-1">
                  <input
                    value={holiday.name}
                    maxLength={120}
                    placeholder="Natal"
                    onChange={(event) => {
                      patch({
                        holidays: draft.holidays.map((one, position) =>
                          position === index ? { ...one, name: event.target.value } : one,
                        ),
                      });
                    }}
                    className={waInputClass}
                  />
                </WaField>

                <button
                  type="button"
                  aria-label={`Remover o feriado ${holiday.name || holiday.date}`}
                  onClick={() => {
                    patch({
                      holidays: draft.holidays.filter((_, position) => position !== index),
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
              disabled={draft.holidays.length >= 60}
              onClick={() => {
                patch({ holidays: [...draft.holidays, { date: '', name: '' }] });
              }}
              className={`${waGhostClass} self-start`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar feriado
            </button>
          </WaCard>

          <WaCard
            title="Mensagem de ausência"
            hint="Enviada quando a mensagem chega fora do horário e nenhuma regra de fora do horário casa."
          >
            <WaField label="Texto" hint="Aceita {nome} e {numero} do contato.">
              <textarea
                rows={3}
                value={draft.awayMessage}
                placeholder="Nosso atendimento é de segunda a sexta, das 9h às 18h. Já anotamos sua mensagem."
                onChange={(event) => {
                  patch({ awayMessage: event.target.value });
                }}
                className={waTextareaClass}
              />
            </WaField>
          </WaCard>

          <button
            type="button"
            disabled={save.isPending}
            onClick={submit}
            className={waPrimaryClass}
          >
            {save.isPending ? 'Salvando…' : 'Salvar horários'}
          </button>
        </div>

        <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
          <WaPhonePreview title="Fora do horário">
            <div className="flex justify-start">
              <div className="wa-tail-in relative max-w-[min(85%,22rem)] rounded-lg rounded-tl-none bg-wa-in px-2.5 py-1.5 text-[14px] leading-snug text-wa-text">
                Boa noite, vocês atendem agora?
                <span className="mt-0.5 block text-right text-[11px] text-wa-muted">22:40</span>
              </div>
            </div>

            <WaBubble kind="text" text={renderWaPreview(draft.awayMessage)} time="22:40" />

            {!draft.enabled ? (
              <p className="flex items-start gap-2 rounded-xl border border-wa-line bg-wa-panel px-3 py-2 text-[12px] text-wa-muted">
                <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Com o horário desligado, essa mensagem não é enviada.
              </p>
            ) : null}
          </WaPhonePreview>
        </div>
      </div>
    </div>
  );
}
