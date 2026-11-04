import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { escapeRegex } from '../../common/utils/regex';
import { ChatAccessService } from '../chat/chat-access.service';
import { Message, MessageDocument } from '../chat/schemas/message.schema';
import { Comment, CommentDocument } from '../collaboration/schemas/comment.schema';
import { DocsAccessService } from '../docs/docs-access.service';
import { DocPage, DocPageDocument } from '../docs/schemas/doc-page.schema';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext, PermissionService } from '../hierarchy/permission.service';
import { Folder, FolderDocument } from '../hierarchy/schemas/folder.schema';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { UsersService } from '../users/users.service';
import { MembersService } from '../workspaces/members.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { MAX_SEARCH_RESULTS, MAX_SEARCH_SCAN, SEARCH_TYPES, SearchType } from './search-fields';

export interface SearchHit {
  type: SearchType;
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SearchResult {
  q: string;
  types: SearchType[];
  results: Partial<Record<SearchType, SearchHit[]>>;
}

/** Matches anywhere in the field, so a partial word still finds the entity. */
function containsRegex(term: string): RegExp {
  return new RegExp(escapeRegex(term), 'i');
}

/** Matches the start of the field, used by the customId of the task (AZD-14). */
function prefixRegex(term: string): RegExp {
  return new RegExp(`^${escapeRegex(term)}`, 'i');
}

/**
 * Global search of the workspace. Every type is filtered by the same permission
 * rules as its own endpoints, so the results never show what the user cannot open.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(DocPage.name) private readonly pages: Model<DocPage>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    private readonly access: HierarchyAccessService,
    private readonly docs: DocsAccessService,
    private readonly chat: ChatAccessService,
    private readonly permissions: PermissionService,
    private readonly members: MembersService,
    private readonly users: UsersService,
  ) {}

  async search(ctx: PermissionContext, query: SearchQueryDto): Promise<SearchResult> {
    const q = query.q.trim();
    const limit = query.limit ?? MAX_SEARCH_RESULTS;
    const types = query.types?.length ? [...new Set(query.types)] : [...SEARCH_TYPES];
    const results: Partial<Record<SearchType, SearchHit[]>> = {};

    // The visible Lists answer both the `list` results and the scope of tasks.
    const needsLists =
      types.includes('list') || types.includes('task') || types.includes('comment');
    const lists = needsLists ? await this.access.visibleLists(ctx) : [];

    if (types.includes('space')) {
      results.space = await this.searchSpaces(ctx, q, limit);
    }

    if (types.includes('folder')) {
      results.folder = await this.searchFolders(ctx, q, limit);
    }

    if (types.includes('list')) {
      results.list = matchByName(lists, q, limit).map(listHit);
    }

    if (types.includes('task')) {
      results.task = (await this.searchTasks(ctx, lists, q, limit)).map(taskHit);
    }

    if (types.includes('comment')) {
      results.comment = await this.searchComments(ctx, lists, q, limit);
    }

    if (types.includes('page')) {
      results.page = await this.searchPages(ctx, q, limit);
    }

    if (types.includes('message')) {
      results.message = await this.searchMessages(ctx, q, limit);
    }

    if (types.includes('user')) {
      results.user = await this.searchUsers(ctx, q, limit);
    }

    return { q, types, results };
  }

  private async searchSpaces(
    ctx: PermissionContext,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const spaces = await this.access.visibleSpaces(ctx);

    return matchByName(spaces, q, limit).map((space) => ({
      type: 'space' as const,
      id: String(space._id),
      name: space.name,
      color: space.color,
      icon: space.icon ?? null,
    }));
  }

  private async searchFolders(
    ctx: PermissionContext,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const docs = await this.folders
      .find({
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        archivedAt: null,
        name: containsRegex(q),
      })
      .sort({ position: 1 })
      .limit(MAX_SEARCH_SCAN)
      .exec();
    const explicit = await this.permissions.explicitLevels(ctx);
    const hits: SearchHit[] = [];

    for (const doc of docs) {
      if (hits.length >= limit) {
        break;
      }

      const chain = await this.access.folderChain(doc);

      if (this.permissions.canView(this.permissions.levelFromChain(ctx, chain, explicit))) {
        hits.push(folderHit(doc));
      }
    }

    return hits;
  }

  /**
   * Prefix of the customId first, then the text index of name/description and the
   * partial match on the name.
   */
  private async searchTasks(
    ctx: PermissionContext,
    lists: ListDocument[],
    q: string,
    limit: number,
  ): Promise<TaskDocument[]> {
    if (lists.length === 0) {
      return [];
    }

    const listIds = lists.map((list) => list._id);
    const byCustomId = await this.tasks
      .find({
        workspaceId: ctx.workspaceId,
        listIds: { $in: listIds },
        deletedAt: null,
        archivedAt: null,
        customId: prefixRegex(q),
      })
      .sort({ customId: 1 })
      .limit(limit)
      .exec();
    const byText = await this.taskTextMatches(ctx, listIds, q, limit);
    const byName = await this.tasks
      .find({
        workspaceId: ctx.workspaceId,
        listIds: { $in: listIds },
        deletedAt: null,
        archivedAt: null,
        name: containsRegex(q),
      })
      .limit(limit)
      .exec();

    return dedupe([...byCustomId, ...byText, ...byName]).slice(0, limit);
  }

  private async searchComments(
    ctx: PermissionContext,
    lists: ListDocument[],
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    if (lists.length === 0) {
      return [];
    }

    const byText = await this.commentTextMatches(ctx, q);
    const byBody = await this.comments
      .find({
        workspaceId: ctx.workspaceId,
        entityType: 'task',
        deletedAt: null,
        bodyText: containsRegex(q),
      })
      .sort({ _id: -1 })
      .limit(MAX_SEARCH_SCAN)
      .exec();
    const candidates: CommentDocument[] = dedupe([...byText, ...byBody]);

    if (candidates.length === 0) {
      return [];
    }

    const visible = new Set(lists.map((list) => String(list._id)));
    const tasks = await this.tasks
      .find({
        workspaceId: ctx.workspaceId,
        _id: { $in: candidates.map((comment) => comment.entityId) },
        deletedAt: null,
      })
      .select('customId name listIds')
      .exec();
    const byId = new Map(
      tasks
        .filter((task) => task.listIds.some((listId) => visible.has(String(listId))))
        .map((task) => [String(task._id), task]),
    );

    return candidates
      .filter((comment) => byId.has(String(comment.entityId)))
      .slice(0, limit)
      .map((comment) => commentHit(comment, byId.get(String(comment.entityId))!.customId));
  }

  /**
   * Pages of the Docs the requester can see: the text index of `contentText`
   * first, then the partial match on the title.
   */
  private async searchPages(
    ctx: PermissionContext,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const docIds = await this.docs.visibleDocIds(ctx);

    if (docIds.length === 0) {
      return [];
    }

    const scope = { workspaceId: ctx.workspaceId, docId: { $in: docIds } };
    const byText = await this.pageTextMatches(scope, q);
    const byTitle = await this.pages
      .find({ ...scope, title: containsRegex(q) })
      .limit(MAX_SEARCH_SCAN)
      .exec();

    return dedupe([...byText, ...byTitle])
      .slice(0, limit)
      .map(pageHit);
  }

  /**
   * Messages of the channels the requester can see: the text index of `bodyText`
   * first, then the partial match.
   */
  private async searchMessages(
    ctx: PermissionContext,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const channelIds = await this.chat.visibleChannelIds(ctx);

    if (channelIds.length === 0) {
      return [];
    }

    const scope = {
      workspaceId: ctx.workspaceId,
      channelId: { $in: channelIds },
      deletedAt: null,
    };
    const byText = await this.messageTextMatches(scope, q);
    const byBody = await this.messages
      .find({ ...scope, bodyText: containsRegex(q) })
      .sort({ _id: -1 })
      .limit(MAX_SEARCH_SCAN)
      .exec();

    return dedupe([...byText, ...byBody])
      .slice(0, limit)
      .map(messageHit);
  }

  /** Text index of the messages; a failure here only loses the stemmed hits. */
  private async messageTextMatches(
    scope: Record<string, unknown>,
    q: string,
  ): Promise<MessageDocument[]> {
    try {
      return await this.messages
        .find({ ...scope, $text: { $search: q } })
        .limit(MAX_SEARCH_SCAN)
        .exec();
    } catch {
      return [];
    }
  }

  /** Text index of the pages; a failure here only loses the stemmed hits. */
  private async pageTextMatches(
    scope: Record<string, unknown>,
    q: string,
  ): Promise<DocPageDocument[]> {
    try {
      return await this.pages
        .find({ ...scope, $text: { $search: q } })
        .limit(MAX_SEARCH_SCAN)
        .exec();
    } catch {
      return [];
    }
  }

  private async searchUsers(
    ctx: PermissionContext,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const memberIds = await this.members.activeUserIdsOf(ctx.workspaceId);
    const users = await this.users.search(memberIds, q, limit);

    return users.map((user) => ({
      type: 'user' as const,
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
    }));
  }

  /**
   * Text index of tasks (name and description). The partial match on the name
   * already covers the common case, so a failure here only loses the stemmed hits.
   */
  private async taskTextMatches(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    q: string,
    limit: number,
  ): Promise<TaskDocument[]> {
    try {
      return await this.tasks
        .find({
          workspaceId: ctx.workspaceId,
          listIds: { $in: listIds },
          deletedAt: null,
          archivedAt: null,
          $text: { $search: q },
        })
        .limit(limit)
        .exec();
    } catch {
      return [];
    }
  }

  /** Text index of the comments, over `bodyText`. */
  private async commentTextMatches(ctx: PermissionContext, q: string): Promise<CommentDocument[]> {
    try {
      return await this.comments
        .find({
          workspaceId: ctx.workspaceId,
          entityType: 'task',
          deletedAt: null,
          $text: { $search: q },
        })
        .limit(MAX_SEARCH_SCAN)
        .exec();
    } catch {
      return [];
    }
  }
}

function matchByName<T extends { name: string }>(docs: T[], q: string, limit: number): T[] {
  const match = containsRegex(q);

  return docs.filter((doc) => match.test(doc.name)).slice(0, limit);
}

function dedupe<T extends { _id: Types.ObjectId }>(docs: T[]): T[] {
  const seen = new Set<string>();

  return docs.filter((doc) => {
    const key = String(doc._id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function listHit(list: ListDocument): SearchHit {
  return {
    type: 'list',
    id: String(list._id),
    name: list.name,
    spaceId: String(list.spaceId),
    folderId: list.folderId ? String(list.folderId) : null,
  };
}

function folderHit(folder: FolderDocument): SearchHit {
  return {
    type: 'folder',
    id: String(folder._id),
    name: folder.name,
    spaceId: String(folder.spaceId),
    parentFolderId: folder.parentFolderId ? String(folder.parentFolderId) : null,
  };
}

function taskHit(task: TaskDocument): SearchHit {
  return {
    type: 'task',
    id: String(task._id),
    name: task.name,
    customId: task.customId,
    listId: String(task.listId),
    statusGroup: task.statusGroup,
    priority: task.priority,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
  };
}

function pageHit(page: DocPageDocument): SearchHit {
  return {
    type: 'page',
    id: String(page._id),
    name: page.title,
    docId: String(page.docId),
    parentPageId: page.parentPageId ? String(page.parentPageId) : null,
    contentText: page.contentText.slice(0, 200),
  };
}

function messageHit(message: MessageDocument): SearchHit {
  return {
    type: 'message',
    id: String(message._id),
    name: message.bodyText.slice(0, 200),
    bodyText: message.bodyText,
    channelId: String(message.channelId),
    parentMessageId: message.parentMessageId ? String(message.parentMessageId) : null,
    authorId: String(message.authorId),
  };
}

function commentHit(comment: CommentDocument, customId: string): SearchHit {
  return {
    type: 'comment',
    id: String(comment._id),
    name: comment.bodyText,
    bodyText: comment.bodyText,
    taskId: String(comment.entityId),
    customId,
    createdBy: String(comment.createdBy),
  };
}
