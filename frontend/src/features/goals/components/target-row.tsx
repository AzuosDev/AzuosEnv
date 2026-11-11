import { Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { GoalTarget } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  TARGET_TYPE_LABEL,
  formatTargetValue,
  isManualTarget,
  nextValue,
  percentLabel,
  progressTone,
  stepOf,
  targetPercent,
} from '../goal-model';

export interface TargetRowProps {
  target: GoalTarget;
  wsId: string;
  canWrite: boolean;
  onValue: (target: GoalTarget, current: number) => void;
  onRemove?: (target: GoalTarget) => void;
}

const TONE_TEXT: Record<string, string> = {
  success: 'text-success',
  accent: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
};

/** Linha do alvo: o tipo, o nome, o valor e como ele se atualiza. */
export function TargetRow({ target, wsId, canWrite, onValue, onRemove }: TargetRowProps) {
  const percent = targetPercent(target);
  const [draft, setDraft] = useState(() => String(target.current));
  const synced = useRef(target.current);

  /**
   * O campo só volta ao valor da API quando ele muda de verdade: um rebusca em
   * segundo plano não pode apagar o número que a pessoa está digitando.
   */
  useEffect(() => {
    if (synced.current !== target.current) {
      synced.current = target.current;
      setDraft(String(target.current));
    }
  }, [target]);

  const commit = (): void => {
    const parsed = Number(draft.replace(',', '.'));

    if (Number.isFinite(parsed) && parsed !== target.current) {
      onValue(target, parsed);
    } else {
      setDraft(String(target.current));
    }
  };

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-3 border-t border-line py-2">
      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-muted">
        {TARGET_TYPE_LABEL[target.type]}
      </span>

      <span className="min-w-0 flex-1 break-words text-[13px] text-ink">{target.name}</span>

      {target.type === 'boolean' ? (
        <label className="flex items-center gap-2 text-[13px] text-body">
          <Checkbox
            checked={percent === 100}
            disabled={!canWrite}
            aria-label={`Marcar ${target.name} como feito`}
            onCheckedChange={(checked) => {
              onValue(target, checked === true ? target.target || 1 : 0);
            }}
          />
          {formatTargetValue(target)}
        </label>
      ) : null}

      {target.type === 'tasks' ? (
        target.listId ? (
          <Link
            to="/w/$wsId/l/$listId"
            params={{ wsId, listId: target.listId }}
            className="text-[13px] font-semibold"
          >
            {formatTargetValue(target)}
          </Link>
        ) : (
          <span className="text-[13px] font-semibold text-ink">{formatTargetValue(target)}</span>
        )
      ) : null}

      {isManualTarget(target) && target.type !== 'boolean' ? (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Diminuir ${target.name}`}
            disabled={!canWrite}
            onClick={() => {
              onValue(target, nextValue(target, -stepOf(target)));
            }}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Input
            aria-label={`Valor de ${target.name}`}
            inputMode="decimal"
            className="w-24 text-center"
            disabled={!canWrite}
            value={draft}
            onChange={(change) => {
              setDraft(change.target.value);
            }}
            onBlur={commit}
            onKeyDown={(key) => {
              if (key.key === 'Enter') {
                key.preventDefault();
                commit();
              }
            }}
          />

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Aumentar ${target.name}`}
            disabled={!canWrite}
            onClick={() => {
              onValue(target, nextValue(target, stepOf(target)));
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <span className="min-w-0 text-[12.5px] text-muted">
        {target.type === 'boolean' || target.type === 'tasks' ? null : formatTargetValue(target)}
      </span>

      <span
        className={cn(
          'w-12 text-right text-[13px] font-semibold',
          TONE_TEXT[progressTone(percent)],
        )}
      >
        {percentLabel(percent)}
      </span>

      {canWrite && onRemove ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir alvo ${target.name}`}
          onClick={() => {
            onRemove(target);
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
