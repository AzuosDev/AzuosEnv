import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { positionBetween } from '../../common/utils/position';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { appendPosition, positionBetweenSiblings, positionedModel } from '../hierarchy/ordering';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { MembersService } from '../workspaces/members.service';
import {
  CreateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto';
import { Checklist, ChecklistDocument, ChecklistItem } from './schemas/checklist.schema';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectModel(Checklist.name) private readonly model: Model<Checklist>,
    private readonly taskAccess: TaskAccessService,
    private readonly members: MembersService,
  ) {}

  async create(
    ctx: PermissionContext,
    idOrCustomId: string,
    dto: CreateChecklistDto,
  ): Promise<ChecklistDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');

    return this.model.create({
      workspaceId: ctx.workspaceId,
      taskId: task._id,
      name: dto.name,
      position: await appendPosition(
        positionedModel(this.model),
        this.siblings(ctx.workspaceId, task._id),
      ),
      items: [],
    });
  }

  async list(ctx: PermissionContext, idOrCustomId: string): Promise<ChecklistDocument[]> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view');

    return this.model
      .find({ workspaceId: ctx.workspaceId, taskId: task._id })
      .sort({ position: 1 })
      .exec();
  }

  async update(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    dto: UpdateChecklistDto,
  ): Promise<ChecklistDocument> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');

    if (dto.name !== undefined) {
      checklist.name = dto.name;
    }

    return checklist.save();
  }

  async reorder(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<ChecklistDocument> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');

    checklist.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx.workspaceId, checklist.taskId),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    return checklist.save();
  }

  async remove(ctx: PermissionContext, checklistId: Types.ObjectId): Promise<void> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');

    await this.model.deleteOne({ _id: checklist._id, workspaceId: ctx.workspaceId }).exec();
  }

  async addItem(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistDocument> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');
    const parentItemId = dto.parentItemId
      ? this.requireParentItem(checklist, dto.parentItemId)
      : null;

    checklist.items.push({
      _id: new Types.ObjectId(),
      text: dto.text,
      done: false,
      assigneeId: await this.requireAssignee(ctx, dto.assigneeId),
      position: this.appendItemPosition(checklist, parentItemId),
      parentItemId,
    });

    return checklist.save();
  }

  async updateItem(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    itemId: Types.ObjectId,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistDocument> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');
    const item = this.requireItem(checklist, itemId);

    if (dto.text !== undefined) {
      item.text = dto.text;
    }

    if (dto.done !== undefined) {
      item.done = dto.done;
    }

    if (dto.assigneeId !== undefined) {
      item.assigneeId = await this.requireAssignee(ctx, dto.assigneeId);
    }

    return checklist.save();
  }

  async reorderItem(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    itemId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<ChecklistDocument> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');
    const item = this.requireItem(checklist, itemId);

    item.position = this.itemPositionBetween(checklist, item, dto.previousId, dto.nextId);

    return checklist.save();
  }

  /** Removes the item and the subitems hanging from it. */
  async removeItem(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<ChecklistDocument> {
    const checklist = await this.requireChecklist(ctx, checklistId, 'edit');

    this.requireItem(checklist, itemId);

    checklist.items = checklist.items.filter(
      (item) =>
        String(item._id) !== String(itemId) && String(item.parentItemId ?? '') !== String(itemId),
    );

    return checklist.save();
  }

  private async requireChecklist(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<ChecklistDocument> {
    const checklist = await this.model
      .findOne({ _id: checklistId, workspaceId: ctx.workspaceId })
      .exec();

    if (!checklist) {
      throw this.checklistNotFound();
    }

    await this.taskAccess.requireTask(ctx, String(checklist.taskId), required);

    return checklist;
  }

  private checklistNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CHECKLIST_NOT_FOUND',
      message: 'Checklist não encontrada.',
    });
  }

  private requireItem(checklist: ChecklistDocument, itemId: Types.ObjectId): ChecklistItem {
    const item = checklist.items.find((candidate) => String(candidate._id) === String(itemId));

    if (!item) {
      throw new NotFoundException({
        code: 'CHECKLIST_ITEM_NOT_FOUND',
        message: 'Item da checklist não encontrado.',
      });
    }

    return item;
  }

  /** Subitems hang from a root item only. */
  private requireParentItem(checklist: ChecklistDocument, parentItemId: string): Types.ObjectId {
    const parent = this.requireItem(checklist, new Types.ObjectId(parentItemId));

    if (parent.parentItemId) {
      throw new BadRequestException({
        code: 'INVALID_CHECKLIST_PARENT',
        message: 'Um subitem não pode receber outros subitens.',
      });
    }

    return parent._id;
  }

  private async requireAssignee(
    ctx: PermissionContext,
    assigneeId: string | null | undefined,
  ): Promise<Types.ObjectId | null> {
    if (!assigneeId) {
      return null;
    }

    const id = new Types.ObjectId(assigneeId);
    const active = await this.members.activeUserIds(ctx.workspaceId, [id]);

    if (active.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_CHECKLIST_ASSIGNEE',
        message: 'O responsável pelo item não é membro ativo deste workspace.',
      });
    }

    return id;
  }

  /** Items of the same parent, in manual order. */
  private siblingItems(
    checklist: ChecklistDocument,
    parentItemId: Types.ObjectId | null,
    excludeId?: Types.ObjectId,
  ): ChecklistItem[] {
    return checklist.items
      .filter(
        (item) =>
          String(item.parentItemId ?? '') === String(parentItemId ?? '') &&
          String(item._id) !== String(excludeId ?? ''),
      )
      .sort((a, b) => (a.position < b.position ? -1 : 1));
  }

  private appendItemPosition(
    checklist: ChecklistDocument,
    parentItemId: Types.ObjectId | null,
  ): string {
    const siblings = this.siblingItems(checklist, parentItemId);

    return positionBetween(siblings[siblings.length - 1]?.position ?? null, null);
  }

  /**
   * Position between the two siblings; the missing side is the item next to the one
   * given, so the rest of the order is kept.
   */
  private itemPositionBetween(
    checklist: ChecklistDocument,
    item: ChecklistItem,
    previousId?: string,
    nextId?: string,
  ): string {
    const siblings = this.siblingItems(checklist, item.parentItemId, item._id);

    if (!previousId && !nextId) {
      return positionBetween(siblings[siblings.length - 1]?.position ?? null, null);
    }

    const previousIndex = previousId === undefined ? null : this.siblingIndex(siblings, previousId);
    const nextIndex = nextId === undefined ? null : this.siblingIndex(siblings, nextId);
    const before =
      previousIndex !== null
        ? siblings[previousIndex].position
        : (siblings[(nextIndex ?? 0) - 1]?.position ?? null);
    const after =
      nextIndex !== null
        ? siblings[nextIndex].position
        : (siblings[(previousIndex ?? 0) + 1]?.position ?? null);

    return positionBetween(before, after);
  }

  private siblingIndex(siblings: ChecklistItem[], id: string): number {
    const index = siblings.findIndex((item) => String(item._id) === id);

    if (index < 0) {
      throw new BadRequestException({
        code: 'INVALID_POSITION',
        message: 'Referência de posição inválida.',
      });
    }

    return index;
  }

  private siblings(workspaceId: Types.ObjectId, taskId: Types.ObjectId): Record<string, unknown> {
    return { workspaceId, taskId };
  }
}
