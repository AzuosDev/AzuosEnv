import type { WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';

export interface AssigneeStackProps {
  ids: string[];
  members: WorkspaceMemberItem[];
  max?: number;
}

/** Avatares dos responsáveis; o que não cabe vira "+n". */
export function AssigneeStack({ ids, members, max = 3 }: AssigneeStackProps) {
  if (ids.length === 0) {
    return <span className="text-[12.5px] text-muted">Sem responsável</span>;
  }

  const people = ids
    .map((id) => members.find((member) => member.userId.id === id)?.userId)
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const shown = people.slice(0, max);
  const rest = ids.length - shown.length;

  return (
    <span className="flex items-center gap-1">
      {shown.map((user) => (
        <Avatar key={user.id} name={user.name} src={user.avatarUrl} className="h-6 w-6" />
      ))}
      {rest > 0 ? <span className="text-[12px] text-muted">+{rest}</span> : null}
      {shown.length === 1 ? (
        <span className="hidden truncate text-[12.5px] text-body lg:inline">{shown[0]?.name}</span>
      ) : null}
    </span>
  );
}
