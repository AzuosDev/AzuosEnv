import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { StatusPill } from '@/components/ui/status-pill';
import { listStatusesQuery, taskQuery } from '@/features/tasks/api';
import { statusTone } from '@/features/tasks/task-fields';

/**
 * Chip da tarefa mencionada: customId, nome e o status ao vivo. As consultas são
 * as mesmas do painel da tarefa, então o cache é reaproveitado e um evento de
 * socket que invalida a tarefa também atualiza o chip.
 */
export function TaskMentionChip({ node, extension }: NodeViewProps) {
  const attrs = node.attrs as { id: string | null; label: string | null };
  const wsId = (extension.options as { wsId: string }).wsId;
  const taskId = attrs.id ?? '';
  const task = useQuery({ ...taskQuery(wsId, taskId), enabled: wsId !== '' && taskId !== '' });
  const detail = task.data;
  const listId = detail ? String(detail.listId) : '';
  const statuses = useQuery({ ...listStatusesQuery(wsId, listId), enabled: listId !== '' });
  const status = statuses.data?.statuses.find((item) => item.id === String(detail?.statusId));
  const label = detail?.name ?? attrs.label ?? 'Tarefa';

  return (
    <NodeViewWrapper as="span" className="inline-flex max-w-full align-baseline">
      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId, customId: detail?.customId ?? taskId }}
        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-scene-line bg-accent/10 px-2 py-0.5 text-[12.5px] text-ink no-underline"
        aria-label={`Tarefa ${label}`}
      >
        {detail ? <span className="shrink-0 text-muted">{detail.customId}</span> : null}
        <span className="min-w-0 truncate font-medium">{label}</span>
        {status ? (
          <StatusPill
            tone={statusTone(status.group, status.color)}
            className="shrink-0 px-1.5 py-0 text-[11px] font-medium"
          >
            {status.name}
          </StatusPill>
        ) : null}
      </Link>
    </NodeViewWrapper>
  );
}
