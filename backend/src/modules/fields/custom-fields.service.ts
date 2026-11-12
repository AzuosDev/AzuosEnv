import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext, ResourceRef } from '../hierarchy/permission.service';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { appendPosition, positionBetweenSiblings, positionedModel } from '../hierarchy/ordering';
import { Task } from '../tasks/schemas/task.schema';
import { MembersService } from '../workspaces/members.service';
import {
  CustomFieldScope,
  DEFAULT_CURRENCY,
  DEFAULT_PRECISION,
  OPTION_FIELD_TYPES,
} from './custom-field-types';
import {
  CustomFieldConfigDto,
  CustomFieldOptionDto,
  CreateCustomFieldDto,
  TaskCustomFieldDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';
import {
  CustomFieldIndex,
  FieldValueEntry,
  isEmptyFieldValue,
  normalizeFieldValue,
} from './field-values';
import { isValidFormula } from './formula';
import { CustomField, CustomFieldDocument } from './schemas/custom-field.schema';

/** Where a view or an export reads its fields from. */
export type FieldLocationType = CustomFieldScope | 'everything';

export interface TaskFieldValue {
  fieldId: Types.ObjectId;
  value: unknown;
}

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectModel(CustomField.name) private readonly model: Model<CustomField>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly access: HierarchyAccessService,
    private readonly members: MembersService,
  ) {}

  fieldNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CUSTOM_FIELD_NOT_FOUND',
      message: 'Campo não encontrado.',
    });
  }

  async create(ctx: PermissionContext, dto: CreateCustomFieldDto): Promise<CustomFieldDocument> {
    const scopeId = new Types.ObjectId(dto.scopeId);

    await this.requireScope(ctx, dto.scope, scopeId, 'edit');

    return this.model.create({
      workspaceId: ctx.workspaceId,
      scope: dto.scope,
      scopeId,
      name: dto.name,
      type: dto.type,
      config: await this.resolveConfig(ctx, dto.type, dto.config, null),
      required: dto.required ?? false,
      position: await appendPosition(positionedModel(this.model), {
        workspaceId: ctx.workspaceId,
        scope: dto.scope,
        scopeId,
      }),
    });
  }

  /** Fields of the scope and of everything above it, in inheritance order. */
  async list(
    ctx: PermissionContext,
    scope: CustomFieldScope,
    scopeId: Types.ObjectId,
  ): Promise<CustomFieldDocument[]> {
    return this.byChain(await this.chainFor(ctx, scope, scopeId, 'view'), ctx.workspaceId);
  }

  async get(ctx: PermissionContext, fieldId: Types.ObjectId): Promise<CustomFieldDocument> {
    const field = await this.requireField(ctx, fieldId, 'view');

    return field;
  }

  async update(
    ctx: PermissionContext,
    fieldId: Types.ObjectId,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldDocument> {
    const field = await this.requireField(ctx, fieldId, 'edit');

    if (dto.name !== undefined) {
      field.name = dto.name;
    }

    if (dto.required !== undefined) {
      field.required = dto.required;
    }

    if (dto.config !== undefined) {
      field.config = await this.resolveConfig(ctx, field.type, dto.config, field);
    }

    return field.save();
  }

  /** Dropping the field also drops its values from the tasks. */
  async remove(ctx: PermissionContext, fieldId: Types.ObjectId): Promise<void> {
    const field = await this.requireField(ctx, fieldId, 'full');

    await this.model.deleteOne({ _id: field._id, workspaceId: ctx.workspaceId }).exec();
    await this.tasks
      .updateMany(
        { workspaceId: ctx.workspaceId, 'customFields.fieldId': field._id },
        { $pull: { customFields: { fieldId: field._id } } },
      )
      .exec();
  }

  async reorder(
    ctx: PermissionContext,
    fieldId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<CustomFieldDocument> {
    const field = await this.requireField(ctx, fieldId, 'edit');

    field.position = await positionBetweenSiblings(
      positionedModel(this.model),
      { workspaceId: ctx.workspaceId, scope: field.scope, scopeId: field.scopeId },
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    return field.save();
  }

  /** Fields available to a task: the Space, the Folders and the List of it. */
  async forList(list: ListDocument): Promise<CustomFieldDocument[]> {
    return this.byChain(await this.access.listChain(list), list.workspaceId);
  }

  /** Fields of a view location; `everything` sees every field of the workspace. */
  async forLocation(
    ctx: PermissionContext,
    locationType: FieldLocationType,
    locationId: Types.ObjectId | null,
  ): Promise<CustomFieldDocument[]> {
    if (locationType === 'everything' || !locationId) {
      return this.model
        .find({ workspaceId: ctx.workspaceId })
        .sort({ scope: 1, position: 1 })
        .exec();
    }

    return this.byChain(
      await this.chainFor(ctx, locationType, locationId, 'view'),
      ctx.workspaceId,
    );
  }

  /** Every field of the workspace, by id and by lowercase name, for the formulas. */
  async indexFor(workspaceId: Types.ObjectId): Promise<CustomFieldIndex> {
    const fields = await this.model.find({ workspaceId }).sort({ position: 1 }).exec();

    return {
      byId: new Map(fields.map((field) => [String(field._id), field])),
      byName: new Map(fields.map((field) => [field.name.toLowerCase(), field])),
    };
  }

  /** Index limited to the given fields, used by a view that already loaded them. */
  indexOf(fields: CustomFieldDocument[]): CustomFieldIndex {
    return {
      byId: new Map(fields.map((field) => [String(field._id), field])),
      byName: new Map(fields.map((field) => [field.name.toLowerCase(), field])),
    };
  }

  /**
   * Merges the values sent by the caller into the ones already stored, validating
   * each one by the type of its field. A null value clears the field.
   */
  async resolveValues(
    ctx: PermissionContext,
    list: ListDocument,
    entries: TaskCustomFieldDto[],
    current: FieldValueEntry[] = [],
  ): Promise<TaskFieldValue[]> {
    const available = new Map(
      (await this.forList(list)).map((field) => [String(field._id), field]),
    );
    const merged = new Map<string, unknown>(
      current.map((entry) => [String(entry.fieldId), entry.value]),
    );

    for (const entry of entries) {
      const field = available.get(entry.fieldId);

      if (!field) {
        throw new BadRequestException({
          code: 'INVALID_CUSTOM_FIELD',
          message: 'Campo personalizado indisponível nesta List.',
        });
      }

      const value = normalizeFieldValue(field, entry.value);

      await this.assertReferences(ctx, field, value);

      if (value === null) {
        merged.delete(entry.fieldId);
      } else {
        merged.set(entry.fieldId, value);
      }
    }

    for (const [id, field] of available) {
      if (field.required && field.type !== 'formula' && isEmptyFieldValue(merged.get(id))) {
        throw new BadRequestException({
          code: 'CUSTOM_FIELD_REQUIRED',
          message: `O campo ${field.name} é obrigatório.`,
        });
      }
    }

    return [...merged].map(([fieldId, value]) => ({
      fieldId: new Types.ObjectId(fieldId),
      value,
    }));
  }

  private async requireField(
    ctx: PermissionContext,
    fieldId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<CustomFieldDocument> {
    const field = await this.model.findOne({ _id: fieldId, workspaceId: ctx.workspaceId }).exec();

    if (!field) {
      throw this.fieldNotFound();
    }

    try {
      await this.requireScope(ctx, field.scope, field.scopeId, required);
    } catch (error) {
      throw isNotFound(error) ? this.fieldNotFound() : error;
    }

    return field;
  }

  private async requireScope(
    ctx: PermissionContext,
    scope: CustomFieldScope,
    scopeId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<void> {
    await this.chainFor(ctx, scope, scopeId, required);
  }

  private async chainFor(
    ctx: PermissionContext,
    scope: CustomFieldScope,
    scopeId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<ResourceRef[]> {
    if (scope === 'space') {
      return this.access.spaceChain(await this.access.requireSpace(ctx, scopeId, required));
    }

    if (scope === 'folder') {
      return this.access.folderChain(await this.access.requireFolder(ctx, scopeId, required));
    }

    return this.access.listChain(await this.access.requireList(ctx, scopeId, required));
  }

  private async byChain(
    chain: ResourceRef[],
    workspaceId: Types.ObjectId,
  ): Promise<CustomFieldDocument[]> {
    const fields = await this.model
      .find({ workspaceId, scopeId: { $in: chain.map((node) => node.resourceId) } })
      .sort({ position: 1 })
      .exec();

    const order = new Map(chain.map((node, index) => [String(node.resourceId), index]));
    const depthOf = (field: CustomFieldDocument): number => order.get(String(field.scopeId)) ?? 0;

    return fields.sort((a, b) => depthOf(a) - depthOf(b) || a.position.localeCompare(b.position));
  }

  /** Keeps option ids stable, defaults the currency and validates the formula. */
  private async resolveConfig(
    ctx: PermissionContext,
    type: CustomField['type'],
    dto: CustomFieldConfigDto | undefined,
    current: CustomFieldDocument | null,
  ): Promise<CustomField['config']> {
    const config: CustomField['config'] = {};

    if ((OPTION_FIELD_TYPES as readonly string[]).includes(type)) {
      const options = dto?.options ?? current?.config?.options ?? [];

      if (options.length === 0) {
        throw new BadRequestException({
          code: 'INVALID_CUSTOM_FIELD',
          message: 'Este tipo de campo exige opções.',
        });
      }

      config.options = options.map((option) => toOption(option));
    }

    if (type === 'currency' || type === 'number') {
      config.precision = dto?.precision ?? current?.config?.precision ?? DEFAULT_PRECISION;
    }

    if (type === 'currency') {
      config.currency = dto?.currency ?? current?.config?.currency ?? DEFAULT_CURRENCY;
    }

    if (type === 'formula') {
      const expression = dto?.expression ?? current?.config?.expression;

      if (!expression || !isValidFormula(expression)) {
        throw new BadRequestException({
          code: 'INVALID_FORMULA',
          message: 'Expressão da fórmula inválida.',
        });
      }

      config.expression = expression;
    }

    if (type === 'relationship') {
      const listId = dto?.relationshipListId
        ? new Types.ObjectId(dto.relationshipListId)
        : current?.config?.relationshipListId;

      if (listId) {
        config.relationshipListId = (await this.access.requireList(ctx, listId, 'view'))._id;
      }
    }

    return config;
  }

  /** People, files and relationship values must point to rows of the workspace. */
  private async assertReferences(
    ctx: PermissionContext,
    field: CustomFieldDocument,
    value: unknown,
  ): Promise<void> {
    if (!Array.isArray(value) || value.length === 0) {
      return;
    }

    const ids = value as Types.ObjectId[];

    if (field.type === 'people') {
      const active = await this.members.activeUserIds(ctx.workspaceId, ids);

      if (active.length !== ids.length) {
        throw new BadRequestException({
          code: 'INVALID_CUSTOM_FIELD_VALUE',
          message: `O campo ${field.name} aceita apenas membros ativos.`,
        });
      }
    }

    if (field.type === 'relationship') {
      const listId = field.config?.relationshipListId;
      const found = await this.tasks
        .countDocuments(
          listId
            ? { workspaceId: ctx.workspaceId, _id: { $in: ids }, listIds: listId, deletedAt: null }
            : { workspaceId: ctx.workspaceId, _id: { $in: ids }, deletedAt: null },
        )
        .exec();

      if (found !== ids.length) {
        throw new BadRequestException({
          code: 'INVALID_CUSTOM_FIELD_VALUE',
          message: `O campo ${field.name} aceita apenas tarefas da List alvo.`,
        });
      }
    }
  }
}

function toOption(option: CustomFieldOptionDto): { id: string; name: string; color?: string } {
  return {
    id: option.id ?? randomUUID(),
    name: option.name,
    ...(option.color ? { color: option.color } : {}),
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof NotFoundException;
}
