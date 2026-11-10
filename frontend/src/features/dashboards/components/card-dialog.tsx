import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  CalculatorOp,
  CalculatorTaskField,
  CardConfig,
  CardType,
  WorkloadMetric,
} from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { customFieldsQuery } from '@/features/tasks/fields-api';
import { LocationSelect } from '@/features/hierarchy/components/location-select';
import { WORKLOAD_METRIC_LABEL } from '@/features/views/workload-model';
import { CARD_KINDS, cardKind } from '../card-kinds';

export interface CardDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Card existente em edição; ausente cria um novo. */
  initial?: { type: CardType; config: CardConfig };
  onConfirm: (value: { type: CardType; config: CardConfig }) => void;
}

const TASK_FIELD_LABEL: Record<CalculatorTaskField, string> = {
  estimateMinutes: 'Estimativa (minutos)',
  points: 'Pontos',
  trackedMinutes: 'Tempo rastreado (minutos)',
};

const OP_LABEL: Record<CalculatorOp, string> = { sum: 'Soma', avg: 'Média' };

/** Tipo e recorte do card: só os campos que o tipo escolhido usa. */
export function CardDialog({ wsId, open, onOpenChange, initial, onConfirm }: CardDialogProps) {
  const [type, setType] = useState<CardType>(initial?.type ?? 'tasksByStatus');
  const [config, setConfig] = useState<CardConfig>(initial?.config ?? {});
  const scope =
    config.location && config.location !== 'everything' && config.locationId
      ? { scope: config.location, scopeId: config.locationId }
      : null;
  const fields = useQuery({
    ...customFieldsQuery(wsId, scope?.scope ?? 'space', scope?.scopeId ?? ''),
    enabled: open && scope !== null,
  });

  useEffect(() => {
    if (open) {
      setType(initial?.type ?? 'tasksByStatus');
      setConfig(initial?.config ?? {});
    }
  }, [open, initial?.type, initial?.config]);

  const kind = cardKind(type);
  const numericFields = (fields.data ?? []).filter(
    (field) => field.type === 'number' || field.type === 'currency' || field.type === 'formula',
  );
  const patch = (changes: CardConfig): void => {
    setConfig((current) => ({ ...current, ...changes }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Configurar card' : 'Novo card'}</DialogTitle>
          <DialogDescription>{kind.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-type">Tipo</Label>
            <SelectNative
              id="card-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as CardType);
              }}
            >
              {CARD_KINDS.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
            </SelectNative>
          </div>

          {kind.fields.includes('location') ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-location">Local</Label>
              <LocationSelect
                id="card-location"
                wsId={wsId}
                value={{ location: config.location ?? 'everything', locationId: config.locationId }}
                onChange={(value) => {
                  setConfig((current) => {
                    const next = { ...current, location: value.location };

                    if (value.locationId) {
                      next.locationId = value.locationId;
                    } else {
                      delete next.locationId;
                    }

                    return next;
                  });
                }}
              />
            </div>
          ) : null}

          {kind.fields.includes('range') ? (
            <div className="flex flex-wrap gap-3">
              <div className="flex min-w-0 flex-1 basis-[140px] flex-col gap-1.5">
                <Label htmlFor="card-from">De</Label>
                <Input
                  id="card-from"
                  type="date"
                  value={config.from ?? ''}
                  onChange={(event) => {
                    patch({ from: event.target.value || undefined });
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-1 basis-[140px] flex-col gap-1.5">
                <Label htmlFor="card-to">Até</Label>
                <Input
                  id="card-to"
                  type="date"
                  value={config.to ?? ''}
                  onChange={(event) => {
                    patch({ to: event.target.value || undefined });
                  }}
                />
              </div>
              <p className="basis-full text-[12px] text-muted">
                Em branco, o card segue o período escolhido no painel.
              </p>
            </div>
          ) : null}

          {kind.fields.includes('metric') ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-metric">Métrica</Label>
              <SelectNative
                id="card-metric"
                value={config.metric ?? 'tasks'}
                onChange={(event) => {
                  patch({ metric: event.target.value as WorkloadMetric });
                }}
              >
                {(['tasks', 'hours', 'points'] as WorkloadMetric[]).map((metric) => (
                  <option key={metric} value={metric}>
                    {WORKLOAD_METRIC_LABEL[metric]}
                  </option>
                ))}
              </SelectNative>
            </div>
          ) : null}

          {kind.fields.includes('calculator') ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-op">Operação</Label>
                <SelectNative
                  id="card-op"
                  value={config.op ?? 'sum'}
                  onChange={(event) => {
                    patch({ op: event.target.value as CalculatorOp });
                  }}
                >
                  {(['sum', 'avg'] as CalculatorOp[]).map((op) => (
                    <option key={op} value={op}>
                      {OP_LABEL[op]}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-field">Campo</Label>
                <SelectNative
                  id="card-field"
                  value={config.fieldId ? `field:${config.fieldId}` : (config.taskField ?? '')}
                  onChange={(event) => {
                    const value = event.target.value;

                    setConfig((current) => {
                      const next = { ...current };

                      delete next.fieldId;
                      delete next.taskField;

                      if (value.startsWith('field:')) {
                        next.fieldId = value.slice('field:'.length);
                      } else if (value) {
                        next.taskField = value as CalculatorTaskField;
                      }

                      return next;
                    });
                  }}
                >
                  <option value="">Escolha um campo</option>
                  <optgroup label="Campos da tarefa">
                    {(Object.keys(TASK_FIELD_LABEL) as CalculatorTaskField[]).map((field) => (
                      <option key={field} value={field}>
                        {TASK_FIELD_LABEL[field]}
                      </option>
                    ))}
                  </optgroup>
                  {numericFields.length > 0 ? (
                    <optgroup label="Campos personalizados">
                      {numericFields.map((field) => (
                        <option key={field.id} value={`field:${field.id}`}>
                          {field.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </SelectNative>
              </div>
            </>
          ) : null}

          {kind.fields.includes('limit') ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-limit">Linhas</Label>
              <Input
                id="card-limit"
                type="number"
                min={1}
                max={500}
                value={config.limit ?? 50}
                onChange={(event) => {
                  patch({ limit: Number(event.target.value) || 50 });
                }}
              />
            </div>
          ) : null}

          {kind.fields.includes('closed') ? (
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-body">
              <Checkbox
                checked={config.includeClosed === true}
                onCheckedChange={(checked) => {
                  patch({ includeClosed: checked === true });
                }}
              />
              Incluir tarefas concluídas e fechadas
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={type === 'calculator' && !config.fieldId && !config.taskField}
            onClick={() => {
              onConfirm({ type, config });
              onOpenChange(false);
            }}
          >
            {initial ? 'Salvar' : 'Adicionar card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
