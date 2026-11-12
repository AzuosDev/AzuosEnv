import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { seriesColor, type ChartPalette } from '../chart-palette';
import type { SeriesPoint, Slice } from '../card-model';

const AXIS_FONT = 11;

function tooltipStyle(palette: ChartPalette): Record<string, string> {
  return {
    background: palette.surface,
    border: `1px solid ${palette.line}`,
    borderRadius: '10px',
    color: palette.ink,
    fontSize: '12px',
  };
}

export interface SliceChartProps {
  slices: Slice[];
  palette: ChartPalette;
  /** Rótulo do valor (Tarefas, Horas…), usado no tooltip e no aria. */
  unit: string;
  format?: (value: number) => string;
}

/**
 * Barras de categoria como no protótipo: nome, barra no tom do token e o
 * número em texto. O valor fica legível sem passar o mouse e sem depender do
 * SVG, que é o que importa em status, pessoa e cliente.
 */
export function SliceRows({ slices, palette, unit, format }: SliceChartProps) {
  const max = slices.reduce((top, slice) => Math.max(top, slice.value), 0) || 1;

  return (
    <ul aria-label={unit} className="flex min-w-0 flex-col gap-2 overflow-y-auto">
      {slices.map((slice, index) => (
        <li
          key={slice.name}
          className="grid min-w-0 items-center gap-2.5"
          style={{ gridTemplateColumns: 'minmax(80px, 130px) minmax(0, 1fr) auto' }}
        >
          <span className="truncate text-[13px] text-body">{slice.name}</span>
          <span className="h-3.5 min-w-0 overflow-hidden rounded bg-surface-2">
            <span
              aria-hidden="true"
              className="block h-3.5 rounded"
              style={{
                width: `${String(Math.max(2, Math.round((slice.value / max) * 100)))}%`,
                background: seriesColor(palette, index),
              }}
            />
          </span>
          <span className="text-right text-[13px] font-semibold text-ink">
            {format ? format(slice.value) : slice.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Rosca para a divisão faturável × não faturável. O número já aparece em texto
 * ao lado, então o desenho entra como decoração.
 */
export function SliceDonut({ slices, palette, unit, format }: SliceChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%">
          {slices.map((slice, index) => (
            <Cell key={slice.name} fill={seriesColor(palette, index)} stroke={palette.surface} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle(palette)}
          formatter={(value, name) => [
            format ? format(Number(value)) : Number(value),
            String(name ?? '') || unit,
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export interface SeriesChartProps {
  points: SeriesPoint[];
  palette: ChartPalette;
  /** Chaves das séries, na ordem da legenda. */
  lines: { key: string; label: string; dashed?: boolean }[];
}

/** Frase do gráfico de linha: o que cada série vale no primeiro e no último dia. */
export function seriesSummary(points: SeriesPoint[], lines: SeriesChartProps['lines']): string {
  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last) {
    return 'Sem dados no período.';
  }

  const parts = lines.map(
    (line) =>
      `${line.label} de ${String(first[line.key] ?? 0)} para ${String(last[line.key] ?? 0)}`,
  );

  return `De ${String(first.label)} a ${String(last.label)}: ${parts.join('; ')}.`;
}

/** Linhas por dia: burndown e burnup. */
export function SeriesLines({ points, palette, lines }: SeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} />
        <XAxis
          dataKey="label"
          stroke={palette.axis}
          tick={{ fill: palette.axis, fontSize: AXIS_FONT }}
          minTickGap={16}
        />
        <YAxis
          stroke={palette.axis}
          tick={{ fill: palette.axis, fontSize: AXIS_FONT }}
          allowDecimals={false}
          width={32}
        />
        <Tooltip contentStyle={tooltipStyle(palette)} />
        {lines.map((line, index) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.dashed ? palette.muted : seriesColor(palette, index)}
            strokeDasharray={line.dashed ? '5 5' : undefined}
            strokeWidth={line.dashed ? 1.5 : 2.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Legenda escrita em texto: o gráfico sozinho não diz quem é quem. */
export function ChartLegend({
  items,
  palette,
}: {
  items: { label: string; index: number; dashed?: boolean }[];
  palette: ChartPalette;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: item.dashed ? palette.muted : seriesColor(palette, item.index),
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
