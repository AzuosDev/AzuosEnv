import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Tag as TagIcon } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Tag } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { toneFromColor, type ColorTone } from '@/lib/colors';
import { createTag, tagsQuery } from '../api';

export interface TagPickerProps {
  wsId: string;
  /** Space da tarefa: é onde a tag nova nasce. */
  spaceId: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
}

const itemClass =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink md:min-h-9';

/** Tom da pílula a partir da cor da tag. */
export function tagTone(tag: Tag | undefined): 'neutral' | ColorTone {
  return tag?.color ? toneFromColor(tag.color) : 'neutral';
}

/** Tags da tarefa. A lista é a do Space e dá para criar uma na hora. */
export function TagPicker({ wsId, spaceId, value, onChange }: TagPickerProps) {
  const queryClient = useQueryClient();
  const tags = useQuery({ ...tagsQuery(wsId, spaceId), enabled: spaceId !== '' });
  const [draft, setDraft] = useState('');

  const create = useMutation({
    mutationFn: (name: string) => createTag(wsId, { spaceId, name }),
    onSuccess: (tag) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags(wsId, spaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags(wsId) });
      setDraft('');
      onChange([...value, tag.id]);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const options = tags.data ?? [];
  const name = draft.trim();
  const exists = options.some((tag) => tag.name.toLowerCase() === name.toLowerCase());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Escolher tags"
          className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2"
        >
          {value.length === 0 ? (
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Vazio
            </span>
          ) : (
            value.map((id) => {
              const tag = options.find((option) => option.id === id);

              return (
                <StatusPill key={id} tone={tagTone(tag)}>
                  {tag?.name ?? 'Tag'}
                </StatusPill>
              );
            })
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12.5px] font-medium text-body">
              Nova tag
              <Input
                value={draft}
                placeholder="Nome da tag"
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && name !== '' && !exists) {
                    event.preventDefault();
                    create.mutate(name);
                  }
                }}
              />
            </label>
            <Button
              size="icon"
              aria-label="Criar tag"
              disabled={name === '' || exists || create.isPending || spaceId === ''}
              onClick={() => {
                create.mutate(name);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2 py-2 text-[12.5px] text-muted">
                Nenhuma tag neste Space ainda. Crie a primeira acima.
              </p>
            ) : null}

            {options.map((tag) => {
              const picked = value.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={picked}
                  className={itemClass}
                  onClick={() => {
                    onChange(picked ? value.filter((id) => id !== tag.id) : [...value, tag.id]);
                  }}
                >
                  <StatusPill tone={tagTone(tag)}>{tag.name}</StatusPill>
                  {picked ? (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
