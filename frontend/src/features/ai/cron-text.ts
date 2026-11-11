import type { AiAgentType } from '@/api/types';

/** Agenda em linguagem simples; o valor é a expressão cron que a API recebe. */
export const SCHEDULE_PRESETS: { value: string; label: string }[] = [
  { value: '0 8 * * *', label: 'Todo dia às 8 h' },
  { value: '0 8 * * 1-5', label: 'De segunda a sexta às 8 h' },
  { value: '0 18 * * 1-5', label: 'De segunda a sexta às 18 h' },
  { value: '0 9 * * 1', label: 'Toda segunda às 9 h' },
  { value: '0 8 1 * *', label: 'Todo dia 1 do mês às 8 h' },
  { value: '0 * * * *', label: 'A cada hora' },
];

export const AGENT_TYPE_LABEL: Record<AiAgentType, string> = {
  dailySummary: 'Resumo diário',
  overdueDigest: 'Tarefas atrasadas',
  bugTriage: 'Triagem de bugs',
};

export const AGENT_TYPE_HINT: Record<AiAgentType, string> = {
  dailySummary: 'Manda no chat o que está em andamento e o que vence hoje.',
  overdueDigest: 'Avisa quem tem tarefa atrasada.',
  bugTriage: 'Classifica os bugs novos por prioridade.',
};

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

function hourText(minute: string, hour: string): string | null {
  const m = Number(minute);
  const h = Number(hour);

  if (!Number.isInteger(m) || !Number.isInteger(h) || m < 0 || m > 59 || h < 0 || h > 23) {
    return null;
  }

  return m === 0 ? `às ${String(h)} h` : `às ${String(h)}h${String(m).padStart(2, '0')}`;
}

function dayText(weekday: string): string | null {
  if (weekday === '1-5') {
    return 'de segunda a sexta';
  }

  if (/^[0-6]$/.test(weekday)) {
    return `toda ${WEEKDAYS[Number(weekday)] ?? ''}`;
  }

  return null;
}

/**
 * Traduz a expressão cron para o português do app ("todo dia às 8 h"). O que
 * não cai num padrão conhecido volta como a própria expressão.
 */
export function cronToText(cron: string): string {
  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) {
    return cron;
  }

  const [minute, hour, day, month, weekday] = parts as [string, string, string, string, string];

  if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'A cada hora';
  }

  const time = hourText(minute, hour);

  if (time === null || month !== '*') {
    return cron;
  }

  if (day === '*' && weekday === '*') {
    return `Todo dia ${time}`;
  }

  if (day === '*') {
    const days = dayText(weekday);

    return days === null ? cron : `${days[0]?.toUpperCase() ?? ''}${days.slice(1)} ${time}`;
  }

  if (weekday === '*' && /^[0-9]{1,2}$/.test(day)) {
    return `Todo dia ${day} do mês ${time}`;
  }

  return cron;
}
