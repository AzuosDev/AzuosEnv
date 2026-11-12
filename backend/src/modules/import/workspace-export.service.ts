import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

/**
 * Collections dumped by the export, in the order a reader would rebuild them.
 * refresh_tokens, api_keys and calendar_connections are left out on purpose: they
 * only hold credentials, which must never travel inside a backup file.
 */
export const EXPORT_COLLECTIONS = [
  'workspace_members',
  'invites',
  'teams',
  'spaces',
  'folders',
  'lists',
  'status_sets',
  'permissions',
  'custom_fields',
  'views',
  'tags',
  'counters',
  'tasks',
  'checklists',
  'comments',
  'attachments',
  'task_dependencies',
  'activities',
  'time_entries',
  'dashboards',
  'automations',
  'automation_runs',
  'templates',
  'docs',
  'doc_pages',
  'doc_page_versions',
  'channels',
  'messages',
  'channel_reads',
  'calendar_events',
  'goal_folders',
  'goals',
  'targets',
  'forms',
  'sprint_folders',
  'whiteboards',
  'notifications',
  'reminders',
  'favorites',
  'recent_items',
  'ai_conversations',
  'ai_usage',
  'ai_agents',
  'github_integrations',
  'outgoing_webhooks',
  'audit_logs',
] as const;

/** Keys dropped from every document; a secret never leaves in the export. */
const SECRET_KEY =
  /^(passwordhash|tokenhash|secrethash|publictokenhash|secret|accesstoken|refreshtoken|rawbody)$/i;

/** Documents taken from one collection; above it the collection is marked truncated. */
export const MAX_EXPORT_DOCS = 20_000;

export interface WorkspaceExport {
  exportedAt: string;
  version: 1;
  workspace: Record<string, unknown>;
  /** Name and e-mail of every user referenced by the membership of the workspace. */
  users: Record<string, unknown>[];
  collections: Record<string, Record<string, unknown>[]>;
  /** Collections cut at MAX_EXPORT_DOCS. */
  truncated: string[];
}

@Injectable()
export class WorkspaceExportService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Everything the workspace holds, as plain JSON, with the secrets removed. */
  async export(workspaceId: Types.ObjectId): Promise<WorkspaceExport> {
    const db = this.connection.db;

    if (!db) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace não encontrado.',
      });
    }

    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace não encontrado.',
      });
    }

    const collections: Record<string, Record<string, unknown>[]> = {};
    const truncated: string[] = [];

    for (const name of EXPORT_COLLECTIONS) {
      const docs = await db
        .collection(name)
        .find({ workspaceId })
        .limit(MAX_EXPORT_DOCS + 1)
        .toArray();

      if (docs.length > MAX_EXPORT_DOCS) {
        truncated.push(name);
        docs.length = MAX_EXPORT_DOCS;
      }

      collections[name] = docs.map((doc) => clean(doc));
    }

    const memberships = await db
      .collection('workspace_members')
      .find({ workspaceId })
      .project({ userId: 1 })
      .limit(MAX_EXPORT_DOCS)
      .toArray();
    const users = await db
      .collection('users')
      .find({ _id: { $in: memberships.map((member) => member.userId as Types.ObjectId) } })
      .project({ name: 1, email: 1, avatarUrl: 1, timezone: 1, locale: 1 })
      .toArray();

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      workspace: clean(workspace),
      users: users.map((user) => clean(user)),
      collections,
      truncated,
    };
  }
}

/** `_id` becomes `id` (as in the API) and every secret key is dropped. */
function clean(document: Record<string, unknown>): Record<string, unknown> {
  return strip(document, 0) as Record<string, unknown>;
}

const MAX_DEPTH = 12;

function strip(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => strip(item, depth + 1));
  }

  if (value instanceof Types.ObjectId) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return undefined;
  }

  const out: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key) || key === '__v') {
      continue;
    }

    const cleaned = strip(item, depth + 1);

    if (cleaned === undefined) {
      continue;
    }

    out[key === '_id' ? 'id' : key] = cleaned;
  }

  return out;
}
