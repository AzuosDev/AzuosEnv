import { Link } from '@tanstack/react-router';
import { MapPin, Star, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { Attachment, CustomField, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  FIELD_PLACEHOLDER,
  PROGRESS_MAX,
  RATING_MAX,
  asLocation,
  asStringArray,
  fieldInputText,
  formatFieldValue,
  isEmptyFieldValue,
  optionsOf,
  parseFieldInput,
} from '../field-values';
import { AssigneeStack } from './assignee-stack';
import { AssigneesPicker } from './task-pickers';
import { TaskSearchPicker } from './task-search-picker';

/** O mínimo de uma tarefa referenciada por um campo de relacionamento. */
export interface RelatedTask {
  id: string;
  name: string;
  customId: string;
}

export interface CustomFieldInputProps {
  wsId: string;
  field: CustomField;
  value: unknown;
  members: WorkspaceMemberItem[];
  /** Anexos da tarefa: é a lista do campo do tipo arquivo. */
  attachments: Attachment[];
  /** Tarefas já referenciadas pelo campo de relacionamento. */
  related: RelatedTask[];
  disabled: boolean;
  onChange: (value: unknown) => void;
}

const triggerClass =
  'flex min-h-9 w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45';

const inputClass =
  'h-9 border-transparent bg-transparent px-1.5 text-[13px] hover:bg-surface-2 focus-visible:border-accent focus-visible:bg-surface';

/** Campo de texto que só grava quando sai do foco ou no Enter. */
function TextCommit({
  label,
  value,
  disabled,
  long,
  type,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  disabled: boolean;
  long?: boolean;
  type?: string;
  placeholder?: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;

  const commit = (): void => {
    setDraft(null);

    if (text !== value) {
      onCommit(text);
    }
  };

  if (long) {
    return (
      <Textarea
        aria-label={label}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="text-[13px]"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <Input
      aria-label={label}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      type={type ?? 'text'}
      className={inputClass}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
          setDraft(null);
        }
      }}
    />
  );
}

/** Nota de 0 a 5 em estrelas, com clique na mesma estrela para limpar. */
function RatingInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {Array.from({ length: RATING_MAX }, (_item, index) => index + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${String(star)} de ${String(RATING_MAX)}`}
          aria-pressed={star <= value}
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-45 md:h-9 md:w-9"
          onClick={() => {
            onChange(star === value ? null : star);
          }}
        >
          <Star
            className={cn('h-4 w-4', star <= value ? 'text-accent' : 'text-muted')}
            aria-hidden="true"
            {...(star <= value ? { fill: 'currentColor' } : {})}
          />
        </button>
      ))}
      <span className="pl-1 text-[12px] text-muted">
        {value > 0 ? `${String(value)}/${String(RATING_MAX)}` : 'Sem nota'}
      </span>
    </div>
  );
}

/** Localização: endereço opcional mais latitude e longitude. */
function LocationInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: CustomField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const current = asLocation(value);
  const addressId = useId();
  const latId = useId();
  const lngId = useId();
  const [draft, setDraft] = useState(() => ({
    address: current?.address ?? '',
    lat: current ? String(current.lat) : '',
    lng: current ? String(current.lng) : '',
  }));

  const commit = (): void => {
    const lat = Number(draft.lat.replace(',', '.'));
    const lng = Number(draft.lng.replace(',', '.'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      onChange(null);

      return;
    }

    onChange({
      lat,
      lng,
      ...(draft.address.trim() === '' ? {} : { address: draft.address.trim() }),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={triggerClass}>
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className={cn('min-w-0 truncate', isEmptyFieldValue(value) && 'text-muted')}>
            {formatFieldValue(field, value) || 'Vazio'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-3">
          <label htmlFor={addressId} className="flex flex-col gap-1.5 text-[12.5px] text-body">
            Endereço
            <Input
              id={addressId}
              value={draft.address}
              onChange={(event) => {
                setDraft((state) => ({ ...state, address: event.target.value }));
              }}
            />
          </label>

          <div className="flex gap-2">
            <label htmlFor={latId} className="flex flex-1 flex-col gap-1.5 text-[12.5px] text-body">
              Latitude
              <Input
                id={latId}
                value={draft.lat}
                inputMode="decimal"
                onChange={(event) => {
                  setDraft((state) => ({ ...state, lat: event.target.value }));
                }}
              />
            </label>
            <label htmlFor={lngId} className="flex flex-1 flex-col gap-1.5 text-[12.5px] text-body">
              Longitude
              <Input
                id={lngId}
                value={draft.lng}
                inputMode="decimal"
                onChange={(event) => {
                  setDraft((state) => ({ ...state, lng: event.target.value }));
                }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft({ address: '', lat: '', lng: '' });
                onChange(null);
              }}
            >
              Limpar
            </Button>
            <Button variant="outline" size="sm" onClick={commit}>
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Lista de opções com várias marcadas (campo de etiquetas e de arquivos). */
function MultiPicker({
  label,
  options,
  value,
  disabled,
  empty,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  disabled: boolean;
  empty: string;
  onChange: (ids: string[]) => void;
}) {
  const picked = options.filter((option) => value.includes(option.id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={label} className={triggerClass}>
          <span className={cn('min-w-0 truncate', picked.length === 0 && 'text-muted')}>
            {picked.length === 0 ? empty : picked.map((option) => option.name).join(', ')}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {options.length === 0 ? (
            <p className="px-2 py-2 text-[12.5px] text-muted">Nada para escolher.</p>
          ) : null}

          {options.map((option) => (
            <label
              key={option.id}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] text-body hover:bg-surface-2 md:min-h-9"
            >
              <Checkbox
                checked={value.includes(option.id)}
                onCheckedChange={() => {
                  onChange(
                    value.includes(option.id)
                      ? value.filter((id) => id !== option.id)
                      : [...value, option.id],
                  );
                }}
              />
              <span className="min-w-0 truncate">{option.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Controle de um campo personalizado, escolhido pelo tipo do campo. Fórmula é
 * só leitura: o valor dela é calculado pela API.
 */
export function CustomFieldInput({
  wsId,
  field,
  value,
  members,
  attachments,
  related,
  disabled,
  onChange,
}: CustomFieldInputProps) {
  const label = field.name;

  if (field.type === 'formula') {
    return (
      <span className="flex min-h-9 items-center px-1.5 text-[13px] text-body">
        {formatFieldValue(field, value) || <span className="text-muted">Sem valor</span>}
      </span>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <Switch
        checked={value === true}
        aria-label={label}
        disabled={disabled}
        onCheckedChange={(checked) => {
          onChange(checked);
        }}
      />
    );
  }

  if (field.type === 'rating') {
    return (
      <RatingInput
        label={label}
        value={typeof value === 'number' ? value : 0}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'progress') {
    const current = typeof value === 'number' ? value : 0;

    return (
      <span className="flex items-center gap-2">
        <input
          type="range"
          aria-label={label}
          min={0}
          max={PROGRESS_MAX}
          step={5}
          value={current}
          disabled={disabled}
          className="h-9 min-w-0 flex-1 accent-accent"
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
        />
        <span className="w-10 shrink-0 text-right text-[12.5px] text-body">{String(current)}%</span>
      </span>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <SelectNative
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        className={cn('h-9 border-transparent bg-transparent text-[13px] hover:bg-surface-2')}
        onChange={(event) => {
          onChange(event.target.value === '' ? null : event.target.value);
        }}
      >
        <option value="">Vazio</option>
        {optionsOf(field).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </SelectNative>
    );
  }

  if (field.type === 'labels') {
    return (
      <MultiPicker
        label={label}
        empty="Sem etiqueta"
        disabled={disabled}
        options={optionsOf(field).map((option) => ({ id: option.id, name: option.name }))}
        value={asStringArray(value)}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'files') {
    return (
      <MultiPicker
        label={label}
        empty="Sem arquivo"
        disabled={disabled}
        options={attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
        }))}
        value={asStringArray(value)}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'people') {
    return (
      <AssigneesPicker
        members={members}
        value={asStringArray(value)}
        disabled={disabled}
        onChange={onChange}
      >
        <button type="button" aria-label={label} className={triggerClass}>
          <AssigneeStack ids={asStringArray(value)} members={members} max={4} />
        </button>
      </AssigneesPicker>
    );
  }

  if (field.type === 'relationship') {
    const ids = asStringArray(value);

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {ids.map((id) => {
          const task = related.find((item) => item.id === id);

          return (
            <span
              key={id}
              className="flex min-w-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px] text-body"
            >
              {task ? (
                <Link
                  to="/w/$wsId/t/$customId"
                  params={{ wsId, customId: task.customId }}
                  className="min-w-0 max-w-40 truncate hover:underline"
                >
                  {task.name}
                </Link>
              ) : (
                <span className="min-w-0 max-w-40 truncate">Tarefa sem acesso</span>
              )}

              {disabled ? null : (
                <button
                  type="button"
                  aria-label={`Remover ${task?.name ?? 'tarefa'} de ${label}`}
                  className="flex h-6 w-6 items-center justify-center text-muted hover:text-ink"
                  onClick={() => {
                    onChange(ids.filter((item) => item !== id));
                  }}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </span>
          );
        })}

        {disabled ? null : (
          <TaskSearchPicker
            wsId={wsId}
            listId={
              field.config.relationshipListId ? String(field.config.relationshipListId) : undefined
            }
            excludeIds={ids}
            label={`Buscar tarefa para ${label}`}
            onPick={(task) => {
              onChange([...ids, task.id]);
            }}
          >
            <Button variant="nav" size="sm" aria-label={`Ligar tarefa em ${label}`}>
              Ligar tarefa
            </Button>
          </TaskSearchPicker>
        )}
      </div>
    );
  }

  if (field.type === 'location') {
    return <LocationInput field={field} value={value} disabled={disabled} onChange={onChange} />;
  }

  if (field.type === 'date') {
    return (
      <span className="flex items-center gap-1">
        <Input
          type="date"
          aria-label={label}
          value={fieldInputText(field, value)}
          disabled={disabled}
          className={inputClass}
          onChange={(event) => {
            onChange(parseFieldInput(field, event.target.value));
          }}
        />
        {isEmptyFieldValue(value) || disabled ? null : (
          <Button
            variant="nav"
            size="icon"
            aria-label={`Limpar ${label}`}
            className="h-11 w-11 md:h-9 md:w-9"
            onClick={() => {
              onChange(null);
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </span>
    );
  }

  if (field.type === 'number' || field.type === 'currency') {
    return (
      <TextCommit
        label={label}
        value={fieldInputText(field, value)}
        disabled={disabled}
        placeholder={FIELD_PLACEHOLDER[field.type]}
        onCommit={(text) => {
          onChange(parseFieldInput(field, text));
        }}
      />
    );
  }

  return (
    <TextCommit
      label={label}
      value={fieldInputText(field, value)}
      disabled={disabled}
      placeholder={FIELD_PLACEHOLDER[field.type]}
      long={field.type === 'longText'}
      type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
      onCommit={(text) => {
        onChange(parseFieldInput(field, text));
      }}
    />
  );
}
