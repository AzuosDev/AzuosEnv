import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { sha256Hex } from '../../common/utils/hash';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { MembersService } from '../workspaces/members.service';
import { CreateFormDto, FormQueryDto, UpdateFormDto } from './dto/form.dto';
import { FORM_TOKEN_BYTES, MAX_FORM_FIELDS } from './form-fields';
import { Form, FormDocument } from './schemas/form.schema';

export interface FormResult {
  form: FormDocument;
  /** Shown only when the form is created; afterwards only the hash is kept. */
  token: string | null;
  url: string | null;
}

/**
 * Forms of a List. The public token is stored only as a sha256 and returned once,
 * on creation, exactly like the share link of a Doc.
 */
@Injectable()
export class FormsService {
  constructor(
    @InjectModel(Form.name) private readonly model: Model<Form>,
    private readonly hierarchy: HierarchyAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly members: MembersService,
    private readonly config: ConfigService,
  ) {}

  formNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'FORM_NOT_FOUND',
      message: 'Formulário não encontrado.',
    });
  }

  async create(ctx: PermissionContext, dto: CreateFormDto): Promise<FormResult> {
    const list = await this.hierarchy.requireList(ctx, new Types.ObjectId(dto.listId), 'edit');

    this.requireFields(dto.fields, dto.conditions ?? []);

    const token = randomBytes(FORM_TOKEN_BYTES).toString('base64url');
    const form = await this.model.create({
      workspaceId: ctx.workspaceId,
      listId: list._id,
      title: dto.title,
      description: dto.description ?? null,
      fields: this.toFields(dto.fields),
      conditions: dto.conditions ?? [],
      defaultAssigneeId: await this.requireAssignee(ctx, dto.defaultAssigneeId ?? null),
      defaultStatusId: await this.requireStatus(list, dto.defaultStatusId ?? null),
      notify: await this.requireNotify(ctx, dto.notify),
      active: dto.active ?? true,
      publicTokenHash: sha256Hex(token),
      submissionCount: 0,
      createdBy: ctx.userId,
    });

    return { form, token, url: this.publicUrl(token) };
  }

  async list(ctx: PermissionContext, query: FormQueryDto): Promise<CursorPage<FormDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId, deletedAt: null };

    if (query.listId) {
      filter.listId = new Types.ObjectId(query.listId);
    }

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.model
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const visible: FormDocument[] = [];

    for (const form of docs) {
      if (await this.canSee(ctx, form)) {
        visible.push(form);
      }
    }

    return buildCursorPage(visible, limit, (doc) => ({ id: String(doc._id) }));
  }

  get(ctx: PermissionContext, formId: Types.ObjectId): Promise<FormDocument> {
    return this.requireForm(ctx, formId, 'view');
  }

  async update(
    ctx: PermissionContext,
    formId: Types.ObjectId,
    dto: UpdateFormDto,
  ): Promise<FormDocument> {
    const form = await this.requireForm(ctx, formId, 'edit');

    if (dto.fields !== undefined || dto.conditions !== undefined) {
      const fields = dto.fields ?? form.fields;
      const conditions = dto.conditions ?? form.conditions;

      this.requireFields(fields, conditions);
      form.fields = this.toFields(fields);
      form.conditions = conditions.map((condition) => ({
        fieldId: condition.fieldId,
        op: condition.op,
        value: condition.value ?? null,
        showFieldIds: condition.showFieldIds,
      }));
    }

    if (dto.title !== undefined) {
      form.title = dto.title;
    }

    if (dto.description !== undefined) {
      form.description = dto.description ?? null;
    }

    if (dto.defaultAssigneeId !== undefined) {
      form.defaultAssigneeId = await this.requireAssignee(ctx, dto.defaultAssigneeId ?? null);
    }

    if (dto.defaultStatusId !== undefined) {
      const list = await this.hierarchy.requireList(ctx, form.listId, 'view');

      form.defaultStatusId = await this.requireStatus(list, dto.defaultStatusId ?? null);
    }

    if (dto.notify !== undefined) {
      form.notify = await this.requireNotify(ctx, dto.notify);
    }

    if (dto.active !== undefined) {
      form.active = dto.active;
    }

    return form.save();
  }

  async remove(ctx: PermissionContext, formId: Types.ObjectId): Promise<void> {
    const form = await this.requireForm(ctx, formId, 'full');

    form.deletedAt = new Date();
    await form.save();
  }

  /** The active form behind a public token; a wrong token looks like no form. */
  async findByToken(token: string): Promise<FormDocument> {
    const form = await this.model
      .findOne({ publicTokenHash: sha256Hex(token), active: true, deletedAt: null })
      .select('+publicTokenHash')
      .exec();

    if (!form) {
      throw this.formNotFound();
    }

    return form;
  }

  publicUrl(token: string): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';

    return `${appUrl.replace(/\/+$/, '')}/public/forms/${token}`;
  }

  private async requireForm(
    ctx: PermissionContext,
    formId: Types.ObjectId,
    level: 'view' | 'edit' | 'full',
  ): Promise<FormDocument> {
    const form = await this.model
      .findOne({ _id: formId, workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!form) {
      throw this.formNotFound();
    }

    try {
      await this.hierarchy.requireList(ctx, form.listId, level);
    } catch {
      throw this.formNotFound();
    }

    return form;
  }

  private async canSee(ctx: PermissionContext, form: FormDocument): Promise<boolean> {
    try {
      await this.hierarchy.requireList(ctx, form.listId, 'view');

      return true;
    } catch {
      return false;
    }
  }

  /** Ids unique, at most the ceiling, and every condition pointing at real fields. */
  private requireFields(
    fields: { id: string; mapTo?: string | null }[],
    conditions: { fieldId: string; showFieldIds: string[] }[],
  ): void {
    if (fields.length === 0) {
      throw this.invalid('Informe pelo menos um campo no formulário.');
    }

    if (fields.length > MAX_FORM_FIELDS) {
      throw this.invalid('O formulário tem campos demais.');
    }

    const ids = new Set(fields.map((field) => field.id));

    if (ids.size !== fields.length) {
      throw this.invalid('Os ids dos campos precisam ser únicos.');
    }

    for (const condition of conditions) {
      if (!ids.has(condition.fieldId)) {
        throw this.invalid('Uma condição aponta para um campo que não existe.');
      }

      for (const fieldId of condition.showFieldIds) {
        if (!ids.has(fieldId)) {
          throw this.invalid('Uma condição revela um campo que não existe.');
        }
      }
    }
  }

  private toFields(fields: CreateFormDto['fields']): Form['fields'] {
    return fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required ?? false,
      options: (field.options ?? []).map((option) => ({ id: option.id, label: option.label })),
      mapTo: field.mapTo ?? null,
    }));
  }

  private async requireAssignee(
    ctx: PermissionContext,
    assigneeId: string | null,
  ): Promise<Types.ObjectId | null> {
    if (!assigneeId) {
      return null;
    }

    const id = new Types.ObjectId(assigneeId);
    const active = await this.members.activeUserIds(ctx.workspaceId, [id]);

    if (active.length === 0) {
      throw this.invalid('O responsável padrão não é membro ativo deste workspace.');
    }

    return id;
  }

  private async requireStatus(
    list: ListDocument,
    statusId: string | null,
  ): Promise<Types.ObjectId | null> {
    if (!statusId) {
      return null;
    }

    const effective = await this.statusSets.resolveForList(list);

    if (!effective.statuses.some((status) => String(status._id) === statusId)) {
      throw this.invalid('O status padrão não existe no conjunto da List.');
    }

    return new Types.ObjectId(statusId);
  }

  private async requireNotify(
    ctx: PermissionContext,
    notify: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!notify?.length) {
      return [];
    }

    const ids = [...new Set(notify)].map((id) => new Types.ObjectId(id));
    const active = await this.members.activeUserIds(ctx.workspaceId, ids);

    if (active.length !== ids.length) {
      throw this.invalid('Um ou mais avisados não são membros ativos deste workspace.');
    }

    return ids;
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_FORM', message });
  }
}
