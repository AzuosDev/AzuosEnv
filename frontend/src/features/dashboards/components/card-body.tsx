import { Link } from '@tanstack/react-router';
import type {
  CardBillable,
  CardBurndown,
  CardBurnup,
  CardCalculator,
  CardTaskList,
  CardTasksByAssignee,
  CardTasksByStatus,
  CardTimeByClient,
  CardTimeByUser,
  CardType,
  WorkloadResult,
} from '@/api/types';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { StatusPill } from '@/components/ui/status-pill';
import type { ChartPalette } from '../chart-palette';
import {
  assigneeSlices,
  billableSlices,
  burndownSeries,
  burnupSeries,
  calculatorValue,
  clientSlices,
  formatHoursValue,
  formatMinutesAsHours,
  statusSlices,
  userSlices,
  workloadSlices,
} from '../card-model';
import { ChartLegend, SeriesLines, SliceDonut, SliceRows } from './card-charts';

export interface CardBodyProps {
  wsId: string;
  type: CardType;
  data: unknown;
  palette: ChartPalette;
}

function Empty({ children }: { children: string }) {
  return <p className="px-1 text-[13px] text-muted">{children}</p>;
}

function Figure({ value, hint }: { value: string; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <span className="text-[32px] font-semibold leading-none tracking-tight text-ink">
        {value}
      </span>
      <span className="text-[12px] text-muted">{hint}</span>
    </div>
  );
}

/** Tabela compacta das tarefas (cards Atrasadas e Tabela). */
function TaskRows({ wsId, data }: { wsId: string; data: CardTaskList }) {
  if (data.items.length === 0) {
    return <Empty>Nenhuma tarefa neste recorte.</Empty>;
  }

  return (
    <div className="min-w-0 overflow-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <caption className="sr-only">Tarefas do card</caption>
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th scope="col" className="py-1 pr-2 font-semibold">
              Tarefa
            </th>
            <th scope="col" className="py-1 pr-2 font-semibold">
              Status
            </th>
            <th scope="col" className="py-1 pr-2 font-semibold">
              Responsáveis
            </th>
            <th scope="col" className="py-1 font-semibold">
              Prioridade
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((task) => (
            <tr key={task.id} className="border-t border-line">
              <td className="max-w-[260px] py-1.5 pr-2">
                <Link
                  to="/w/$wsId/t/$customId"
                  params={{ wsId, customId: task.customId }}
                  className="block truncate text-ink hover:text-accent"
                >
                  <span className="text-[11.5px] text-muted">{task.customId}</span> {task.name}
                </Link>
              </td>
              <td className="py-1.5 pr-2">
                <StatusPill tone="neutral">{task.status || '—'}</StatusPill>
              </td>
              <td className="max-w-[160px] truncate py-1.5 pr-2 text-body">
                {task.assignees.join(', ') || '—'}
              </td>
              <td className="py-1.5">
                {task.priority ? <PriorityFlag priority={task.priority} /> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.total > data.items.length ? (
        <p className="pt-2 text-[12px] text-muted">
          {data.items.length} de {data.total} tarefas.
        </p>
      ) : null}
    </div>
  );
}

/** Corpo do card pelo tipo; `data` vem do contrato e é lido por tipo. */
export function CardBody({ wsId, type, data, palette }: CardBodyProps) {
  if (type === 'tasksByStatus') {
    const slices = statusSlices(data as CardTasksByStatus);

    return slices.length === 0 ? (
      <Empty>Nenhuma tarefa neste recorte.</Empty>
    ) : (
      <SliceRows slices={slices} palette={palette} unit="Tarefas" />
    );
  }

  if (type === 'tasksByAssignee') {
    const slices = assigneeSlices(data as CardTasksByAssignee);

    return slices.length === 0 ? (
      <Empty>Nenhuma tarefa neste recorte.</Empty>
    ) : (
      <SliceRows slices={slices} palette={palette} unit="Tarefas" />
    );
  }

  if (type === 'workload') {
    const slices = workloadSlices(data as WorkloadResult);

    return slices.length === 0 ? (
      <Empty>Ninguém com carga neste recorte.</Empty>
    ) : (
      <SliceRows slices={slices} palette={palette} unit="Carga" />
    );
  }

  if (type === 'burndown') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <ChartLegend
          palette={palette}
          items={[
            { label: 'Restante', index: 0 },
            { label: 'Ideal', index: 1, dashed: true },
          ]}
        />
        <div className="min-h-0 flex-1">
          <SeriesLines
            points={burndownSeries(data as CardBurndown)}
            palette={palette}
            lines={[
              { key: 'restante', label: 'Restante' },
              { key: 'ideal', label: 'Ideal', dashed: true },
            ]}
          />
        </div>
      </div>
    );
  }

  if (type === 'burnup') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <ChartLegend
          palette={palette}
          items={[
            { label: 'Escopo', index: 0 },
            { label: 'Concluído', index: 1 },
          ]}
        />
        <div className="min-h-0 flex-1">
          <SeriesLines
            points={burnupSeries(data as CardBurnup)}
            palette={palette}
            lines={[
              { key: 'escopo', label: 'Escopo' },
              { key: 'concluido', label: 'Concluído' },
            ]}
          />
        </div>
      </div>
    );
  }

  if (type === 'timeByClient') {
    const slices = clientSlices(data as CardTimeByClient);

    return slices.length === 0 ? (
      <Empty>Nenhuma hora lançada neste recorte.</Empty>
    ) : (
      <SliceRows slices={slices} palette={palette} unit="Horas" format={formatHoursValue} />
    );
  }

  if (type === 'timeByUser') {
    const slices = userSlices(data as CardTimeByUser);

    return slices.length === 0 ? (
      <Empty>Nenhuma hora lançada neste recorte.</Empty>
    ) : (
      <SliceRows slices={slices} palette={palette} unit="Horas" format={formatHoursValue} />
    );
  }

  if (type === 'billable') {
    const billable = data as CardBillable;
    const slices = billableSlices(billable);
    const hint = `${formatHoursValue(billable.billableHours)} de ${formatHoursValue(
      billable.totalHours,
    )}`;

    return (
      <div className="flex min-h-0 flex-1 items-center gap-4">
        <Figure value={`${String(billable.billablePercent)}%`} hint={hint} />
        {slices.length > 0 ? (
          <div className="min-h-[90px] min-w-0 flex-1">
            <SliceDonut
              slices={slices}
              palette={palette}
              unit="Minutos"
              format={formatMinutesAsHours}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (type === 'calculator') {
    const calculator = data as CardCalculator;
    const operation = calculator.op === 'avg' ? 'Média' : 'Soma';

    return (
      <Figure
        value={calculatorValue(calculator)}
        hint={`${operation} de ${String(calculator.count)} tarefas`}
      />
    );
  }

  return <TaskRows wsId={wsId} data={data as CardTaskList} />;
}
