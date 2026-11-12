import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TASK_CREATED,
  TASK_DELETED,
  TASK_MOVED,
  TASK_UPDATED,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskMovedEvent,
  TaskUpdatedEvent,
} from '../tasks/task-events';
import { TargetsService } from './targets.service';

type AnyTaskEvent = TaskCreatedEvent | TaskUpdatedEvent | TaskDeletedEvent | TaskMovedEvent;

/**
 * Keeps the targets of the type `tasks` in sync: every write on a task that a
 * target counts recomputes its total and its current value.
 */
@Injectable()
export class GoalsListener {
  private readonly logger = new Logger(GoalsListener.name);

  constructor(private readonly targets: TargetsService) {}

  @OnEvent(TASK_CREATED)
  onCreated(event: TaskCreatedEvent): Promise<void> {
    return this.refresh(event);
  }

  @OnEvent(TASK_UPDATED)
  onUpdated(event: TaskUpdatedEvent): Promise<void> {
    return this.refresh(event);
  }

  @OnEvent(TASK_DELETED)
  onDeleted(event: TaskDeletedEvent): Promise<void> {
    return this.refresh(event);
  }

  @OnEvent(TASK_MOVED)
  onMoved(event: TaskMovedEvent): Promise<void> {
    return this.refresh(event, [event.fromListId, event.toListId]);
  }

  /** A failing refresh never breaks the request that produced the event. */
  private async refresh(event: AnyTaskEvent, listIds = [event.listId]): Promise<void> {
    try {
      await this.targets.refreshForTask(event.workspaceId, event.taskId, listIds);
    } catch (error) {
      this.logger.error(
        'Falha ao atualizar os alvos da meta.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
