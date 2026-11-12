import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Workbook } from 'exceljs';
import { Model, Types } from 'mongoose';
import { slugify } from '../../common/utils/slug';
import { CustomFieldsService } from '../fields/custom-fields.service';
import { fieldValueMap } from '../fields/field-values';
import { CustomFieldDocument } from '../fields/schemas/custom-field.schema';
import { PermissionContext } from '../hierarchy/permission.service';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { TaskQueryDto } from '../tasks/dto/task-query.dto';
import { Tag } from '../tasks/schemas/tag.schema';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { PRIORITY_LABELS } from '../tasks/task-fields';
import { TaskQueryService } from '../tasks/task-query.service';
import { UsersService } from '../users/users.service';
import { ViewConfigDto } from './dto/view.dto';
import { ViewDocument } from './schemas/view.schema';
import {
  DEFAULT_EXPORT_COLUMNS,
  ExportFormat,
  FIELD_COLUMN_PREFIX,
  TASK_COLUMN_LABELS,
  TaskColumn,
} from './view-types';
import { ViewsService } from './views.service';

export interface ExportResult {
  filename: string;
  contentType: string;
  body: Buffer;
}

interface ExportColumn {
  key: string;
  label: string;
  width?: number;
  field?: CustomFieldDocument;
}

type Cell = string | number | null;

const CSV_BOM = '﻿';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Exports the tasks of a saved view, reusing the query of the view itself. */
@Injectable()
export class ViewExportService {
  constructor(
    @InjectModel(Tag.name) private readonly tags: Model<Tag>,
    private readonly views: ViewsService,
    private readonly queries: TaskQueryService,
    private readonly fields: CustomFieldsService,
    private readonly statusSets: StatusSetsService,
    private readonly users: UsersService,
  ) {}

  async export(
    ctx: PermissionContext,
    viewId: Types.ObjectId,
    format: ExportFormat,
  ): Promise<ExportResult> {
    const view = await this.views.requireVisible(ctx, viewId);
    const tasks = await this.queries.queryAll(ctx, queryOf(view));
    const fields = await this.fields.forLocation(ctx, view.locationType, view.locationId);
    const columns = resolveColumns(view, fields);
    const rows = await this.rows(ctx, tasks, fields, columns);
    const filename = slugify(view.name);

    return format === 'xlsx'
      ? {
          filename: `${filename}.xlsx`,
          contentType: XLSX_TYPE,
          body: await toXlsx(view, columns, rows),
        }
      : {
          filename: `${filename}.csv`,
          contentType: 'text/csv; charset=utf-8',
          body: toCsv(columns, rows),
        };
  }

  private async rows(
    ctx: PermissionContext,
    tasks: TaskDocument[],
    fields: CustomFieldDocument[],
    columns: ExportColumn[],
  ): Promise<Cell[][]> {
    const index = this.fields.indexOf(fields);
    const values = new Map(
      tasks.map((task) => [String(task._id), fieldValueMap(task.customFields, index)]),
    );
    const statuses = await this.statusSets.statusIndex(ctx.workspaceId);
    const names = await this.users.namesByIds(peopleIds(tasks, values, fields));
    const tagNames = await this.tagNames(ctx, tasks);

    return tasks.map((task) =>
      columns.map((column) => {
        if (column.field) {
          return formatFieldValue(
            column.field,
            values.get(String(task._id))?.get(column.key.slice(FIELD_COLUMN_PREFIX.length)),
            names,
          );
        }

        return formatTaskColumn(task, column.key as TaskColumn, statuses, names, tagNames);
      }),
    );
  }

  private async tagNames(
    ctx: PermissionContext,
    tasks: TaskDocument[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(tasks.flatMap((task) => task.tagIds.map(String)))];

    if (ids.length === 0) {
      return new Map();
    }

    const docs = await this.tags
      .find({ workspaceId: ctx.workspaceId, _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();

    return new Map(docs.map((doc) => [String(doc._id), doc.name]));
  }
}

/** The query of the view: its location plus the filters and the order of the config. */
function queryOf(view: ViewDocument): TaskQueryDto {
  const config = view.config as ViewConfigDto;
  const filters = config.filters ?? {};

  return {
    ...filters,
    location: view.locationType,
    locationId: view.locationId ? String(view.locationId) : undefined,
    groupBy: 'none',
    sortBy: config.sortBy,
    sortFieldId: config.sortFieldId,
    includeSubtasks: config.showSubtasks ?? filters.includeSubtasks,
    includeClosed: config.showClosed ?? filters.includeClosed,
    limit: undefined,
    cursor: undefined,
  } as TaskQueryDto;
}

function resolveColumns(view: ViewDocument, fields: CustomFieldDocument[]): ExportColumn[] {
  const byId = new Map(fields.map((field) => [String(field._id), field]));
  const config = view.config as ViewConfigDto;
  const chosen = config.columns?.filter((column) => column.visible !== false) ?? [];

  if (chosen.length === 0) {
    return [
      ...DEFAULT_EXPORT_COLUMNS.map((key) => ({ key, label: TASK_COLUMN_LABELS[key] })),
      ...fields.map((field) => ({
        key: `${FIELD_COLUMN_PREFIX}${String(field._id)}`,
        label: field.name,
        field,
      })),
    ];
  }

  const columns: ExportColumn[] = [];

  for (const column of chosen) {
    if (column.key.startsWith(FIELD_COLUMN_PREFIX)) {
      const field = byId.get(column.key.slice(FIELD_COLUMN_PREFIX.length));

      if (field) {
        columns.push({ key: column.key, label: field.name, width: column.width, field });
      }

      continue;
    }

    const label = TASK_COLUMN_LABELS[column.key as TaskColumn];

    if (label) {
      columns.push({ key: column.key, label, width: column.width });
    }
  }

  return columns;
}

function peopleIds(
  tasks: TaskDocument[],
  values: Map<string, Map<string, unknown>>,
  fields: CustomFieldDocument[],
): Types.ObjectId[] {
  const ids = new Set<string>();

  for (const task of tasks) {
    for (const id of task.assigneeIds) {
      ids.add(String(id));
    }

    for (const field of fields) {
      if (field.type !== 'people') {
        continue;
      }

      const value = values.get(String(task._id))?.get(String(field._id));

      for (const id of Array.isArray(value) ? value : []) {
        ids.add(String(id));
      }
    }
  }

  return [...ids].map((id) => new Types.ObjectId(id));
}

function formatTaskColumn(
  task: TaskDocument,
  column: TaskColumn,
  statuses: Map<string, { name: string }>,
  names: Map<string, string>,
  tagNames: Map<string, string>,
): Cell {
  if (column === 'status') {
    return statuses.get(String(task.statusId))?.name ?? '';
  }

  if (column === 'priority') {
    return PRIORITY_LABELS[task.priority ?? 'none'];
  }

  if (column === 'assignees') {
    return task.assigneeIds.map((id) => names.get(String(id)) ?? '').join(', ');
  }

  if (column === 'tags') {
    return task.tagIds.map((id) => tagNames.get(String(id)) ?? '').join(', ');
  }

  if (column === 'startAt' || column === 'dueAt') {
    return task[column]?.toISOString() ?? '';
  }

  if (column === 'createdAt') {
    return ((task.get('createdAt') as Date | undefined) ?? task._id.getTimestamp()).toISOString();
  }

  if (column === 'estimateMinutes' || column === 'points') {
    return task[column] ?? null;
  }

  return task[column];
}

function formatFieldValue(
  field: CustomFieldDocument,
  value: unknown,
  names: Map<string, string>,
): Cell {
  if (value === null || value === undefined) {
    return '';
  }

  if (field.type === 'checkbox') {
    return value === true ? 'Sim' : 'Não';
  }

  if (field.type === 'dropdown') {
    return optionName(field, String(value));
  }

  if (field.type === 'labels') {
    return asArray(value)
      .map((item) => optionName(field, String(item)))
      .join(', ');
  }

  if (field.type === 'people') {
    return asArray(value)
      .map((item) => names.get(String(item)) ?? '')
      .join(', ');
  }

  if (field.type === 'location') {
    const location = value as { lat?: number; lng?: number; address?: string };

    return location.address ?? `${location.lat ?? ''}, ${location.lng ?? ''}`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return value;
  }

  return Array.isArray(value) ? value.map(String).join(', ') : String(value);
}

function optionName(field: CustomFieldDocument, id: string): string {
  return (field.config?.options ?? []).find((option) => option.id === id)?.name ?? id;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toCsv(columns: ExportColumn[], rows: Cell[][]): Buffer {
  const lines = [columns.map((column) => csvCell(column.label)).join(',')];

  for (const row of rows) {
    lines.push(row.map((cell) => csvCell(cell)).join(','));
  }

  return Buffer.from(`${CSV_BOM}${lines.join('\r\n')}\r\n`, 'utf8');
}

function csvCell(value: Cell): string {
  if (value === null) {
    return '';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return `"${value.replace(/"/g, '""')}"`;
}

async function toXlsx(
  view: ViewDocument,
  columns: ExportColumn[],
  rows: Cell[][],
): Promise<Buffer> {
  const workbook = new Workbook();

  workbook.creator = 'Azuos Env';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName(view.name));

  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: column.width ? Math.round(column.width / 8) : 24,
  }));

  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row.map((cell) => (cell === null ? '' : cell)));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Excel refuses some characters and more than 31 of them in a sheet name. */
function sheetName(name: string): string {
  const clean = name.replace(/[[\]*/\\?:]/g, ' ').trim();

  return clean.length > 0 ? clean.slice(0, 31) : 'Tarefas';
}
