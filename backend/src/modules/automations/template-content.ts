import { TaskDescription } from '../tasks/schemas/task.schema';
import { TaskPriority, TaskType } from '../tasks/task-fields';
import { ViewType } from '../views/view-types';

export interface ChecklistItemSnapshot {
  text: string;
  children: ChecklistItemSnapshot[];
}

export interface ChecklistSnapshot {
  name: string;
  items: ChecklistItemSnapshot[];
}

/**
 * A task without its ids: assignees, tags and status are left out because they do
 * not survive another location, and the dates travel as offsets in minutes.
 */
export interface TaskSnapshot {
  name: string;
  description: TaskDescription;
  descriptionText: string;
  priority: TaskPriority | null;
  type: TaskType;
  points: number | null;
  estimateMinutes: number | null;
  dueHasTime: boolean;
  startOffsetMinutes: number | null;
  dueOffsetMinutes: number | null;
  checklists: ChecklistSnapshot[];
  subtasks: TaskSnapshot[];
}

export interface ViewSnapshot {
  type: ViewType;
  name: string;
  config: Record<string, unknown>;
  pinned: boolean;
}

export interface ListSnapshot {
  name: string;
  color: string | null;
  description: string | null;
  tasks: TaskSnapshot[];
  views: ViewSnapshot[];
}

export interface FolderSnapshot {
  name: string;
  private: boolean;
  /** Folders nest at most one level, the same limit the hierarchy enforces. */
  folders: FolderSnapshot[];
  lists: ListSnapshot[];
}

export interface SpaceSnapshot {
  name: string;
  color: string | null;
  icon: string | null;
  private: boolean;
  folders: FolderSnapshot[];
  lists: ListSnapshot[];
}

export type TemplateContent =
  SpaceSnapshot | FolderSnapshot | ListSnapshot | TaskSnapshot | ChecklistSnapshot | ViewSnapshot;

/** Tasks carried by the snapshot, subtasks included. */
export function countTasks(tasks: TaskSnapshot[]): number {
  return tasks.reduce((total, task) => total + 1 + countTasks(task.subtasks), 0);
}
