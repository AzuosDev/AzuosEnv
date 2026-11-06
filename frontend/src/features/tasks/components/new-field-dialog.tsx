import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CustomField, CustomFieldType } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRECISION,
  FIELD_TYPE_LABEL,
  FIELD_TYPE_ORDER,
  OPTION_FIELD_TYPES,
} from '../field-values';
import { createCustomField } from '../fields-api';
import { ListPicker } from './list-picker';

export interface NewFieldDialogProps {
  wsId: string;
  /** A List aberta: o campo nasce nela e vale para as tarefas dela. */
  listId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (field: CustomField) => void;
}

const MAX_OPTIONS = 50;

/** Cria um campo personalizado na List sem sair do painel da tarefa. */
export function NewFieldDialog({
  wsId,
  listId,
  open,
  onOpenChange,
  onCreated,
}: NewFieldDialogProps) {
  const nameId = useId();
  const typeId = useId();
  const currencyId = useId();
  const precisionId = useId();
  const expressionId = useId();
  const requiredId = useId();
  const relationId = useId();

  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(['']);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [precision, setPrecision] = useState(String(DEFAULT_PRECISION));
  const [expression, setExpression] = useState('');
  const [relationshipListId, setRelationshipListId] = useState('');

  const withOptions = OPTION_FIELD_TYPES.includes(type);
  const numeric = type === 'number' || type === 'currency';
  const cleanOptions = options.map((option) => option.trim()).filter((option) => option !== '');

  const reset = (): void => {
    setName('');
    setType('text');
    setRequired(false);
    setOptions(['']);
    setCurrency(DEFAULT_CURRENCY);
    setPrecision(String(DEFAULT_PRECISION));
    setExpression('');
    setRelationshipListId('');
  };

  const create = useMutation({
    mutationFn: () =>
      createCustomField(wsId, {
        scope: 'list',
        scopeId: listId,
        name: name.trim(),
        type,
        required,
        config: {
          ...(withOptions ? { options: cleanOptions.map((option) => ({ name: option })) } : {}),
          ...(numeric
            ? {
                precision: Number(precision),
                ...(type === 'currency' ? { currency: currency.trim().toUpperCase() } : {}),
              }
            : {}),
          ...(type === 'formula' ? { expression: expression.trim() } : {}),
          ...(type === 'relationship' && relationshipListId !== '' ? { relationshipListId } : {}),
        },
      }),
    onSuccess: (field) => {
      onCreated(field);
      onOpenChange(false);
      reset();
      toast.success('Campo criado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const invalid =
    name.trim() === '' ||
    (withOptions && cleanOptions.length === 0) ||
    (type === 'formula' && expression.trim() === '') ||
    (type === 'relationship' && relationshipListId === '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo campo</DialogTitle>
          <DialogDescription>
            O campo nasce nesta List e vale para todas as tarefas dela.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
          <label htmlFor={nameId} className="flex flex-col gap-1.5 text-[13px] text-body">
            Nome
            <Input
              id={nameId}
              value={name}
              placeholder="Tipo de serviço"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>

          <label htmlFor={typeId} className="flex flex-col gap-1.5 text-[13px] text-body">
            Tipo
            <SelectNative
              id={typeId}
              value={type}
              onChange={(event) => {
                setType(event.target.value as CustomFieldType);
              }}
            >
              {FIELD_TYPE_ORDER.map((option) => (
                <option key={option} value={option}>
                  {FIELD_TYPE_LABEL[option]}
                </option>
              ))}
            </SelectNative>
          </label>

          {withOptions ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1 text-[13px] text-body">Opções</legend>

              {options.map((option, index) => (
                <span key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Opção ${String(index + 1)}`}
                    value={option}
                    onChange={(event) => {
                      setOptions((current) =>
                        current.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      );
                    }}
                  />
                  <Button
                    variant="nav"
                    size="icon"
                    aria-label={`Remover opção ${String(index + 1)}`}
                    disabled={options.length === 1}
                    onClick={() => {
                      setOptions((current) =>
                        current.filter((_item, position) => position !== index),
                      );
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </span>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={options.length >= MAX_OPTIONS}
                onClick={() => {
                  setOptions((current) => [...current, '']);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar opção
              </Button>
            </fieldset>
          ) : null}

          {numeric ? (
            <div className="flex gap-2">
              {type === 'currency' ? (
                <label
                  htmlFor={currencyId}
                  className="flex flex-1 flex-col gap-1.5 text-[13px] text-body"
                >
                  Moeda
                  <Input
                    id={currencyId}
                    value={currency}
                    maxLength={3}
                    onChange={(event) => {
                      setCurrency(event.target.value);
                    }}
                  />
                </label>
              ) : null}

              <label
                htmlFor={precisionId}
                className="flex flex-1 flex-col gap-1.5 text-[13px] text-body"
              >
                Casas decimais
                <SelectNative
                  id={precisionId}
                  value={precision}
                  onChange={(event) => {
                    setPrecision(event.target.value);
                  }}
                >
                  {['0', '1', '2', '3', '4'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectNative>
              </label>
            </div>
          ) : null}

          {type === 'formula' ? (
            <label htmlFor={expressionId} className="flex flex-col gap-1.5 text-[13px] text-body">
              Expressão
              <Input
                id={expressionId}
                value={expression}
                placeholder="{Horas} * {Valor hora}"
                onChange={(event) => {
                  setExpression(event.target.value);
                }}
              />
              <span className="text-[12px] text-muted">
                Entre chaves vão os nomes de campos numéricos da mesma List.
              </span>
            </label>
          ) : null}

          {type === 'relationship' ? (
            <label htmlFor={relationId} className="flex flex-col gap-1.5 text-[13px] text-body">
              List relacionada
              <ListPicker
                wsId={wsId}
                id={relationId}
                value={relationshipListId}
                onChange={setRelationshipListId}
              />
            </label>
          ) : null}

          <label
            htmlFor={requiredId}
            className="flex items-center justify-between gap-2 text-[13px] text-body"
          >
            Obrigatório em toda tarefa
            <Switch id={requiredId} checked={required} onCheckedChange={setRequired} />
          </label>
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
            variant="outline"
            disabled={invalid || create.isPending}
            onClick={() => {
              create.mutate();
            }}
          >
            Criar campo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
