import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { useMemo } from 'react';
import { errorMessage } from '@/api/errors';
import { Spinner } from '@/components/ui/spinner';
import { membersQuery } from '@/features/settings/api';
import { cn } from '@/lib/utils';
import { waOverviewQuery } from '../api';
import {
  WA_PERIODS,
  dayBars,
  durationLabel,
  initialsOf,
  waPeriodRange,
  type WaPeriodDays,
} from '../whatsapp-model';
import { WaCard } from './wa-form';
import { WaEmpty } from './wa-empty';

export interface OverviewTabProps {
  wsId: string;
  period: WaPeriodDays;
  onPeriodChange: (days: WaPeriodDays) => void;
}

function dayLabel(date: string): string {
  const parsed = parseISO(date);

  return Number.isNaN(parsed.getTime()) ? date : format(parsed, 'd/MM', { locale: ptBR });
}

function percentLabel(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
}

function countLabel(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/** Um número do painel, com o rótulo em cima e o apoio embaixo. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-b border-wa-line py-2.5 last:border-b-0 sm:border-b-0 sm:py-0">
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-wa-muted">{label}</dt>
      <dd className="text-[22px] font-semibold leading-tight text-wa-text">{value}</dd>
      {hint ? <p className="text-[12px] text-wa-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Aba Visão geral (supervisor): os números do atendimento no período. É leitura,
 * então a tela é instrumentação — um painel denso de valores rotulados, o
 * desenho das conversas novas por dia e a tabela por atendente.
 */
export function OverviewTab({ wsId, period, onPeriodChange }: OverviewTabProps) {
  // A janela é fixada no primeiro render do período: recalcular a cada render
  // trocaria a query key de segundo em segundo e refaria a chamada sem parar.
  const range = useMemo(() => waPeriodRange(period), [period]);
  const query = useQuery(waOverviewQuery(wsId, range));
  const members = useQuery(membersQuery(wsId));
  const overview = query.data;
  const bars = dayBars(overview);

  const nameOf = (userId: string): string => {
    const member = (members.data ?? []).find((item) => item.userId.id === userId);

    return member ? member.userId.name || member.userId.email : 'Sem responsável';
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 text-[15px] font-semibold text-wa-text">
          Atendimento no período
        </h2>

        <div role="group" aria-label="Período" className="flex gap-1">
          {WA_PERIODS.map((item) => (
            <button
              key={item.days}
              type="button"
              aria-pressed={item.days === period}
              onClick={() => {
                onPeriodChange(item.days);
              }}
              className={cn(
                'flex min-h-11 items-center rounded-xl border px-3 text-[13px] font-semibold md:min-h-10',
                item.days === period
                  ? 'border-wa-accent bg-wa-accent text-wa-panel'
                  : 'border-wa-line text-wa-muted hover:text-wa-text',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? <Spinner label="Carregando a visão geral" /> : null}

      {query.isError ? (
        <WaEmpty
          title="Não foi possível carregar os números"
          description={errorMessage(query.error)}
          icon={<AlertTriangle className="h-7 w-7" aria-hidden="true" />}
        />
      ) : null}

      {overview ? (
        <>
          {overview.truncated ? (
            <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/15 px-3 py-2 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />O período
              passou do teto de conversas lidas: os números cobrem só parte dele.
            </p>
          ) : null}

          <WaCard
            title="Conversas"
            hint={`De ${format(parseISO(overview.from), "d 'de' MMM", { locale: ptBR })} a ${format(
              parseISO(overview.to),
              "d 'de' MMM 'de' yyyy",
              { locale: ptBR },
            )} · fuso ${overview.timezone}`}
          >
            <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-3 sm:gap-y-5 lg:grid-cols-4">
              <Figure label="Total" value={countLabel(overview.conversations)} />
              <Figure label="Abertas" value={countLabel(overview.byStatus.open)} />
              <Figure label="Aguardando" value={countLabel(overview.byStatus.waiting)} />
              <Figure label="Finalizadas" value={countLabel(overview.byStatus.closed)} />
              <Figure
                label="Primeira resposta"
                value={durationLabel(overview.firstResponseAvgSeconds)}
                hint="Média até um atendente responder."
              />
              <Figure
                label="Resolução"
                value={durationLabel(overview.resolutionAvgSeconds)}
                hint="Média da abertura até finalizar."
              />
              <Figure
                label="Resolvidas pelo bot"
                value={percentLabel(overview.botResolvedPercent)}
                hint={`${countLabel(overview.botResolved)} de ${countLabel(
                  overview.resolved,
                )} finalizadas no período.`}
              />
              <Figure
                label="Finalizadas no período"
                value={countLabel(overview.resolved)}
                hint="Conta o fechamento, não a abertura."
              />
            </dl>
          </WaCard>

          <WaCard title="Novas por dia" hint="Conversas que começaram em cada dia do período.">
            {bars.length === 0 || bars.every((bar) => bar.count === 0) ? (
              <p className="py-4 text-center text-[13px] text-wa-muted">
                Nenhuma conversa nova no período.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="flex h-36 min-w-full items-end gap-px" aria-hidden="true">
                    {bars.map((bar) => (
                      <div
                        key={bar.date}
                        title={`${dayLabel(bar.date)}: ${countLabel(bar.count)}`}
                        className="flex min-w-[3px] flex-1 flex-col justify-end"
                      >
                        <span
                          className="rounded-t-sm bg-wa-accent"
                          style={{
                            height: `${String(Math.max(bar.ratio * 100, bar.count > 0 ? 4 : 1))}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <p className="flex items-center justify-between text-[12px] text-wa-muted">
                  <span>{dayLabel(bars[0]?.date ?? '')}</span>
                  <span>{dayLabel(bars[bars.length - 1]?.date ?? '')}</span>
                </p>

                <table className="sr-only">
                  <caption>Conversas novas por dia</caption>
                  <thead>
                    <tr>
                      <th scope="col">Dia</th>
                      <th scope="col">Conversas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bars.map((bar) => (
                      <tr key={bar.date}>
                        <th scope="row">{dayLabel(bar.date)}</th>
                        <td>{countLabel(bar.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </WaCard>

          <WaCard title="Por atendente" hint="Conversas atribuídas a cada pessoa no período.">
            {overview.byAgent.length === 0 ? (
              <WaEmpty
                title="Nenhuma conversa atribuída"
                description="Quando a fila for distribuída, o desempenho de cada atendente aparece aqui."
                icon={<BarChart3 className="h-7 w-7" aria-hidden="true" />}
              />
            ) : (
              <ul className="flex flex-col">
                {overview.byAgent.map((agent) => {
                  const name = nameOf(agent.userId);

                  return (
                    <li
                      key={agent.userId}
                      className="flex min-h-11 flex-wrap items-center gap-3 border-b border-wa-line py-2.5 last:border-b-0"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wa-accent text-[13px] font-semibold text-wa-panel"
                      >
                        {initialsOf(name)}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-wa-text">
                        {name}
                      </span>

                      <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-[12px] text-wa-muted">
                        <div className="flex gap-1">
                          <dt>Conversas</dt>
                          <dd className="font-semibold text-wa-text">
                            {countLabel(agent.conversations)}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt>Finalizadas</dt>
                          <dd className="font-semibold text-wa-text">
                            {countLabel(agent.resolved)}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt>Mensagens</dt>
                          <dd className="font-semibold text-wa-text">
                            {countLabel(agent.messages)}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt>1ª resposta</dt>
                          <dd className="font-semibold text-wa-text">
                            {durationLabel(agent.firstResponseAvgSeconds)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}
          </WaCard>
        </>
      ) : null}
    </div>
  );
}
