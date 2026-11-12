import type { WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';

export interface PresenceAvatarsProps {
  /** Quem está na sala da tarefa agora, inclusive você. */
  userIds: string[];
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  max?: number;
}

/** Avatares de quem está vendo a tarefa agora, pela presença do socket. */
export function PresenceAvatars({
  userIds,
  members,
  currentUserId,
  max = 3,
}: PresenceAvatarsProps) {
  const others = userIds.filter((id) => id !== currentUserId);

  if (others.length === 0) {
    return null;
  }

  const people = others.map((id) => ({
    id,
    name: members.find((member) => member.userId.id === id)?.userId.name ?? 'Alguém',
    avatarUrl: members.find((member) => member.userId.id === id)?.userId.avatarUrl,
  }));
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const names = people.map((person) => person.name).join(', ');

  return (
    <span
      title={`Vendo agora: ${names}`}
      aria-label={`Vendo agora: ${names}`}
      className="flex shrink-0 items-center gap-1 rounded-full border border-line px-1.5 py-0.5"
    >
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} src={person.avatarUrl} className="h-6 w-6" />
      ))}
      {rest > 0 ? <span className="text-[12px] text-muted">+{String(rest)}</span> : null}
    </span>
  );
}
