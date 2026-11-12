import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { CustomField, FormFieldInput, FormFieldKind } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import {
  FORM_FIELD_KINDS,
  FORM_FIELD_LABEL,
  MAP_TARGETS,
  MAP_TARGET_LABEL,
  kindNeedsOptions,
} from '../form-model';

export interface FieldEditorProps {
  field: FormFieldInput;
  index: number;
  total: number;
  /** Campos personalizados da List, que a pergunta também pode preencher. */
  customFields: CustomField[];
  onChange: (field: FormFieldInput) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

/** Uma pergunta no construtor: rótulo, tipo, obrigatório, opções e mapeamento. */
export function FieldEditor({
  field,
  index,
  total,
  customFields,
  onChange,
  onMove,
  onRemove,
}: FieldEditorProps) {
  const options = field.options ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold text-muted">Pergunta {String(index + 1)}</span>
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="nav"
            size="icon"
            aria-label={`Mover ${field.label} para cima`}
            disabled={index === 0}
            onClick={() => {
              onMove(-1);
            }}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="nav"
            size="icon"
            aria-label={`Mover ${field.label} para baixo`}
            disabled={index === total - 1}
            onClick={() => {
              onMove(1);
            }}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="nav"
            size="icon"
            aria-label={`Excluir ${field.label}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </span>
      </div>

      <div>
        <Label htmlFor={`field-label-${field.id}`}>Pergunta</Label>
        <Input
          id={`field-label-${field.id}`}
          value={field.label}
          onChange={(change) => {
            onChange({ ...field, label: change.target.value });
          }}
        />
      </div>

      <div>
        <Label htmlFor={`field-type-${field.id}`}>Tipo</Label>
        <SelectNative
          id={`field-type-${field.id}`}
          value={field.type}
          onChange={(change) => {
            const type = change.target.value as FormFieldKind;

            onChange({
              ...field,
              type,
              options: kindNeedsOptions(type)
                ? options.length > 0
                  ? options
                  : [{ id: 'o1', label: 'Opção 1' }]
                : [],
            });
          }}
        >
          {FORM_FIELD_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {FORM_FIELD_LABEL[kind]}
            </option>
          ))}
        </SelectNative>
      </div>

      {kindNeedsOptions(field.type) ? (
        <div className="flex flex-col gap-2">
          <Label>Opções</Label>
          {options.map((option, position) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                aria-label={`Opção ${String(position + 1)} de ${field.label}`}
                value={option.label}
                onChange={(change) => {
                  onChange({
                    ...field,
                    options: options.map((item) =>
                      item.id === option.id ? { ...item, label: change.target.value } : item,
                    ),
                  });
                }}
              />
              <Button
                variant="nav"
                size="icon"
                aria-label={`Excluir opção ${option.label}`}
                disabled={options.length === 1}
                onClick={() => {
                  onChange({
                    ...field,
                    options: options.filter((item) => item.id !== option.id),
                  });
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              onChange({
                ...field,
                options: [
                  ...options,
                  {
                    id: `o${String(options.length + 1)}`,
                    label: `Opção ${String(options.length + 1)}`,
                  },
                ],
              });
            }}
          >
            Nova opção
          </Button>
        </div>
      ) : null}

      <div>
        <Label htmlFor={`field-map-${field.id}`}>Preenche na tarefa</Label>
        <SelectNative
          id={`field-map-${field.id}`}
          value={field.mapTo ?? ''}
          onChange={(change) => {
            onChange({ ...field, mapTo: change.target.value === '' ? null : change.target.value });
          }}
        >
          <option value="">Só fica na descrição</option>
          {MAP_TARGETS.map((target) => (
            <option key={target} value={target}>
              {MAP_TARGET_LABEL[target]}
            </option>
          ))}
          {customFields.length > 0 ? (
            <optgroup label="Campos personalizados">
              {customFields.map((custom) => (
                <option key={custom.id} value={`customField:${custom.id}`}>
                  {custom.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </SelectNative>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`field-required-${field.id}`} className="text-[13px]">
          Obrigatório
        </Label>
        <Switch
          id={`field-required-${field.id}`}
          checked={field.required ?? false}
          onCheckedChange={(checked) => {
            onChange({ ...field, required: checked });
          }}
        />
      </div>
    </div>
  );
}
