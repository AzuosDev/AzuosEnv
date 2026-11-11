import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Channel, CreateChannelInput, UpdateChannelInput } from '@/api/types';
import { toast } from '@/components/ui/toast';
import {
  addChannelMembers,
  archiveChannel,
  createChannel,
  joinChannel,
  leaveChannel,
  markChannelRead,
  openDm,
  removeChannelMember,
  updateChannel,
} from '../api';

export interface ChannelActions {
  create: (input: CreateChannelInput) => Promise<Channel | null>;
  dm: (userId: string) => Promise<Channel | null>;
  update: (channelId: string, body: UpdateChannelInput) => void;
  archive: (channelId: string) => Promise<void>;
  join: (channelId: string) => void;
  leave: (channelId: string) => void;
  addMembers: (channelId: string, userIds: string[]) => void;
  removeMember: (channelId: string, userId: string) => void;
  pending: boolean;
}

/** Escritas do canal. Toda rota devolve o canal inteiro, então o cache é refeito. */
export function useChannelActions(wsId: string): ChannelActions {
  const queryClient = useQueryClient();

  const refresh = useCallback(
    (channel?: Channel) => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'channels'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });

      if (channel) {
        queryClient.setQueryData(queryKeys.channel(wsId, channel.id), channel);
      }
    },
    [queryClient, wsId],
  );

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const write = useMutation({
    mutationFn: ({ run }: { run: () => Promise<Channel> }) => run(),
    onSuccess: (channel) => {
      refresh(channel);
    },
    onError,
  });

  const drop = useMutation({
    mutationFn: (channelId: string) => archiveChannel(wsId, channelId),
    onSuccess: () => {
      refresh();
      toast.success('Canal arquivado.');
    },
    onError,
  });

  const run = async (task: () => Promise<Channel>): Promise<Channel | null> => {
    try {
      return await write.mutateAsync({ run: task });
    } catch {
      return null;
    }
  };

  return {
    create: (input) => run(() => createChannel(wsId, input)),
    dm: (userId) => run(() => openDm(wsId, userId)),
    update: (channelId, body) => {
      write.mutate({ run: () => updateChannel(wsId, channelId, body) });
    },
    archive: async (channelId) => {
      await drop.mutateAsync(channelId).catch(() => undefined);
    },
    join: (channelId) => {
      write.mutate({ run: () => joinChannel(wsId, channelId) });
    },
    leave: (channelId) => {
      write.mutate({ run: () => leaveChannel(wsId, channelId) });
    },
    addMembers: (channelId, userIds) => {
      write.mutate({ run: () => addChannelMembers(wsId, channelId, userIds) });
    },
    removeMember: (channelId, userId) => {
      write.mutate({ run: () => removeChannelMember(wsId, channelId, userId) });
    },
    pending: write.isPending || drop.isPending,
  };
}

/**
 * Marca o canal como lido ao visualizar: uma vez ao abrir e de novo a cada
 * mensagem nova enquanto a aba está em foco.
 */
export function useMarkRead(wsId: string, channelId: string, lastMessageId: string | null): void {
  const queryClient = useQueryClient();
  const sent = useRef('');

  useEffect(() => {
    if (channelId === '') {
      return;
    }

    const mark = (): void => {
      const stamp = `${channelId}:${lastMessageId ?? ''}`;

      if (sent.current === stamp || document.visibilityState === 'hidden') {
        return;
      }

      sent.current = stamp;
      void markChannelRead(wsId, channelId)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });
        })
        .catch(() => {
          // Sem permissão ou canal fora do alcance: a leitura não é crítica.
          sent.current = '';
        });
    };

    mark();
    document.addEventListener('visibilitychange', mark);

    return () => {
      document.removeEventListener('visibilitychange', mark);
    };
  }, [wsId, channelId, lastMessageId, queryClient]);
}
