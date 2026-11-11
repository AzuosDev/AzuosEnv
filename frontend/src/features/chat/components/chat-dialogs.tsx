import { useState } from 'react';
import type { Channel, Message, WorkspaceMemberItem } from '@/api/types';
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
import { Switch } from '@/components/ui/switch';
import {
  LocationSelect,
  type LocationValue,
} from '@/features/hierarchy/components/location-select';
import { ListPicker } from '@/features/tasks/components/list-picker';
import { channelTitle, memberUser, messagePreview } from '../chat-model';
import type { CreateChannelInput } from '@/api/types';

export interface NewChannelDialogProps {
  wsId: string;
  open: boolean;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  pending: boolean;
  /** Local já escolhido, quando o canal nasce da aba de um Space, Folder ou List. */
  fixedLocation?: LocationValue;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateChannelInput) => void;
}

/** Canal novo: nome, local da hierarquia, público ou privado e participantes. */
export function NewChannelDialog({
  wsId,
  open,
  members,
  currentUserId,
  pending,
  fixedLocation,
  onOpenChange,
  onCreate,
}: NewChannelDialogProps) {
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [location, setLocation] = useState<LocationValue>(
    fixedLocation ?? { location: 'everything' },
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const invalid = name.trim() === '';

  const submit = (): void => {
    if (invalid || pending) {
      return;
    }

    const locationType = location.location === 'everything' ? 'workspace' : location.location;

    onCreate({
      name: name.trim(),
      locationType,
      ...(location.locationId ? { locationId: location.locationId } : {}),
      ...(isPrivate ? { private: true, memberIds: [...picked] } : {}),
    });
    setName('');
    setPrivate(false);
    setPicked(new Set());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Novo canal</DialogTitle>
          <DialogDescription>
            O canal fica ligado a um local da hierarquia e aparece como aba dele.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-name">Nome</Label>
            <Input
              id="channel-name"
              value={name}
              placeholder="usolutionspdv"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-location">Local</Label>
            {fixedLocation ? (
              <SelectNative id="channel-location" value="fixed" disabled>
                <option value="fixed">Local desta tela</option>
              </SelectNative>
            ) : (
              <LocationSelect
                id="channel-location"
                wsId={wsId}
                value={location}
                onChange={setLocation}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
            <span className="flex flex-col">
              <Label htmlFor="channel-private">Privado</Label>
              <span className="text-[12.5px] text-muted">
                Só os participantes escolhidos veem o canal.
              </span>
            </span>
            <Switch
              id="channel-private"
              checked={isPrivate}
              onCheckedChange={(next) => {
                setPrivate(next);
              }}
            />
          </div>

          {isPrivate ? (
            <fieldset className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              <legend className="pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Participantes
              </legend>
              {members
                .filter((member) => member.userId.id !== currentUserId)
                .map((member) => (
                  <label
                    key={member.userId.id}
                    className="flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-[13px] text-body hover:bg-surface-2"
                  >
                    <Checkbox
                      checked={picked.has(member.userId.id)}
                      onCheckedChange={(next) => {
                        setPicked((current) => {
                          const copy = new Set(current);

                          if (next === true) {
                            copy.add(member.userId.id);
                          } else {
                            copy.delete(member.userId.id);
                          }

                          return copy;
                        });
                      }}
                    />
                    <span className="min-w-0 truncate">{member.userId.name}</span>
                  </label>
                ))}
            </fieldset>
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
          <Button disabled={invalid || pending} onClick={submit}>
            Criar canal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface NewDmDialogProps {
  open: boolean;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (userId: string) => void;
}

/** Conversa direta: escolhe a pessoa; a mesma DM é reaproveitada. */
export function NewDmDialog({
  open,
  members,
  currentUserId,
  pending,
  onOpenChange,
  onPick,
}: NewDmDialogProps) {
  const [term, setTerm] = useState('');
  const text = term.trim().toLowerCase();
  const people = members
    .filter((member) => member.userId.id !== currentUserId)
    .filter((member) => text === '' || member.userId.name.toLowerCase().includes(text));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dm-search">Pessoa</Label>
          <Input
            id="dm-search"
            value={term}
            placeholder="Buscar pelo nome"
            onChange={(event) => {
              setTerm(event.target.value);
            }}
          />
        </div>

        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {people.map((member) => (
            <li key={member.userId.id}>
              <button
                type="button"
                disabled={pending}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink"
                onClick={() => {
                  onPick(member.userId.id);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{member.userId.name}</span>
                <span className="shrink-0 text-[11.5px] text-muted">{member.userId.email}</span>
              </button>
            </li>
          ))}

          {people.length === 0 ? (
            <li className="px-2 py-3 text-[13px] text-muted">Ninguém com esse nome.</li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export interface MessageToTaskDialogProps {
  wsId: string;
  message: Message | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (listId: string) => void;
}

/** "Criar tarefa" a partir da mensagem: escolhe a List de destino. */
export function MessageToTaskDialog({
  wsId,
  message,
  pending,
  onOpenChange,
  onCreate,
}: MessageToTaskDialogProps) {
  const [listId, setListId] = useState('');

  return (
    <Dialog
      open={message !== null}
      onOpenChange={(next) => {
        if (!next) {
          setListId('');
        }

        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Criar tarefa da mensagem</DialogTitle>
          <DialogDescription>{message ? messagePreview(message, 140) : ''}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to-task-list">List</Label>
          <ListPicker id="to-task-list" wsId={wsId} value={listId} onChange={setListId} />
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
            disabled={listId === '' || pending}
            onClick={() => {
              onCreate(listId);
              setListId('');
            }}
          >
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ChannelMembersDialogProps {
  open: boolean;
  channel: Channel;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  pending: boolean;
  /** Falso em quem não administra o canal: a lista fica só leitura. */
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (userIds: string[]) => void;
  onRemove: (userId: string) => void;
}

/** Participantes do canal, com adicionar e remover para quem administra. */
export function ChannelMembersDialog({
  open,
  channel,
  members,
  currentUserId,
  pending,
  canManage,
  onOpenChange,
  onAdd,
  onRemove,
}: ChannelMembersDialogProps) {
  const [picked, setPicked] = useState('');
  const inside = channel.memberIds.map(String);
  const outside = members.filter((member) => !inside.includes(member.userId.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{`Participantes de ${channelTitle(channel, members, currentUserId)}`}</DialogTitle>
        </DialogHeader>

        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {inside.map((userId) => {
            const person = memberUser(members, userId);

            return (
              <li
                key={userId}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] text-body"
              >
                <span className="min-w-0 flex-1 truncate">{person?.name ?? 'Pessoa removida'}</span>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      onRemove(userId);
                    }}
                  >
                    Remover
                  </Button>
                ) : null}
              </li>
            );
          })}

          {inside.length === 0 ? (
            <li className="px-2 py-3 text-[13px] text-muted">Canal aberto a todo o workspace.</li>
          ) : null}
        </ul>

        {canManage && outside.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-add-member">Adicionar pessoa</Label>
            <div className="flex gap-2">
              <SelectNative
                id="channel-add-member"
                value={picked}
                onChange={(event) => {
                  setPicked(event.target.value);
                }}
              >
                <option value="">Escolha a pessoa</option>
                {outside.map((member) => (
                  <option key={member.userId.id} value={member.userId.id}>
                    {member.userId.name}
                  </option>
                ))}
              </SelectNative>
              <Button
                disabled={picked === '' || pending}
                onClick={() => {
                  onAdd([picked]);
                  setPicked('');
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
