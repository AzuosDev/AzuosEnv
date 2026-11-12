import type { ViewConfig } from '@/api/types';

/**
 * `config.options` é o espaço livre de cada tipo de view no contrato (escala do
 * Gantt, modo do Calendário, métrica do Workload). O contrato tipa o valor como
 * JSON qualquer, então ler e gravar passa só por aqui.
 */
export function viewOption<T extends string>(
  config: ViewConfig,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = config.options?.[key];

  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function viewNumberOption(
  config: ViewConfig,
  key: string,
  allowed: readonly number[],
  fallback: number,
): number {
  const value = config.options?.[key];

  return typeof value === 'number' && allowed.includes(value) ? value : fallback;
}

export function withViewOption(config: ViewConfig, key: string, value: unknown): ViewConfig {
  return { ...config, options: { ...(config.options ?? {}), [key]: value } };
}
