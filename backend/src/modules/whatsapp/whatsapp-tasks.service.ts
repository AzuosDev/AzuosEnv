import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { escapeRegex } from '../../common/utils/regex';
import { List } from '../hierarchy/schemas/list.schema';
import { ListsService } from '../hierarchy/lists.service';
import { Space } from '../hierarchy/schemas/space.schema';
import { SpacesService } from '../hierarchy/spaces.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { TasksService } from '../tasks/tasks.service';
import { Workspace } from '../workspaces/schemas/workspace.schema';
import { WaConversationLeadDto, WaConversationTaskDto } from './dto/whatsapp.dto';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { LEAD_LIST_NAME, LEAD_SPACE_NAME, WaAccessLevel } from './whatsapp-fields';

/**
 * Bridge with the rest of the Azuos Env: a conversation becomes a task, or a lead
 * in Comercial › Leads. The task is created by the services of the hierarchy, so
 * the permission of the destination and the domain events keep working.
 */
@Injectable()
export class WhatsappTasksService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    private readonly conversations: WhatsappConversationsService,
    private readonly contacts: WhatsappContactsService,
    private readonly tasks: TasksService,
    private readonly spacesService: SpacesService,
    private readonly listsService: ListsService,
    private readonly config: ConfigService,
  ) {}

  /** Task on the List chosen by the requester, linked back to the conversation. */
  async createTask(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: WaConversationTaskDto,
  ): Promise<TaskDocument> {
    return this.create(ctx, level, conversationId, new Types.ObjectId(dto.listId), dto.name);
  }

  /** Lead in Comercial › Leads; the Space and the List are created if missing. */
  async createLead(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: WaConversationLeadDto,
  ): Promise<TaskDocument> {
    const listId = dto.listId ? new Types.ObjectId(dto.listId) : await this.leadListId(ctx);

    return this.create(ctx, level, conversationId, listId, dto.name);
  }

  private async create(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    listId: Types.ObjectId,
    name: string | undefined,
  ): Promise<TaskDocument> {
    const conversation = await this.conversations.require(ctx, level, conversationId);
    const contact = await this.contacts.require(ctx, conversation.contactId);
    const workspace = await this.workspaces.findOne({ _id: ctx.workspaceId }).exec();
    const label = contact.name || contact.profileName || contact.waId;
    const link = `${(this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '')}/whatsapp/conversations/${String(conversation._id)}`;

    return this.tasks.create(ctx, listId, workspace?.taskPrefix ?? 'TASK', {
      name: name ?? `WhatsApp: ${label}`,
      descriptionText: `Conversa do WhatsApp com ${label} (${contact.waId}).\n${link}`,
    });
  }

  /** List Leads of the Space Comercial, created on the first lead. */
  private async leadListId(ctx: PermissionContext): Promise<Types.ObjectId> {
    const space =
      (await this.spaces
        .findOne({
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          name: new RegExp(`^${escapeRegex(LEAD_SPACE_NAME)}$`, 'i'),
        })
        .exec()) ?? (await this.spacesService.create(ctx, { name: LEAD_SPACE_NAME }));
    const list = await this.lists
      .findOne({
        workspaceId: ctx.workspaceId,
        spaceId: space._id,
        deletedAt: null,
        name: new RegExp(`^${escapeRegex(LEAD_LIST_NAME)}$`, 'i'),
      })
      .exec();

    if (list) {
      return list._id;
    }

    const created = await this.listsService.create(ctx, {
      name: LEAD_LIST_NAME,
      spaceId: String(space._id),
    });

    return created._id;
  }
}
