import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { AutomationEngineService } from '../automations/automation-engine.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto } from '../tasks/dto/task.dto';
import { TASK_PRIORITIES, TaskPriority } from '../tasks/task-fields';
import { TasksService } from '../tasks/tasks.service';
import { Workspace } from '../workspaces/schemas/workspace.schema';
import { SubmitFormDto } from './dto/form-submission.dto';
import { visibleFieldIds } from './form-conditions';
import {
  MAX_ANSWER_LENGTH,
  MAX_SUBMISSION_LENGTH,
  customFieldIdOf,
  isCustomFieldTarget,
} from './form-fields';
import { FormsService } from './forms.service';
import { Form, FormDocument } from './schemas/form.schema';

/** Read-only definition the public page renders; nothing internal travels in it. */
export interface PublicFormView {
  id: string;
  title: string;
  description: string | null;
  fields: {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: { id: string; label: string }[];
  }[];
  conditions: { fieldId: string; op: string; value: unknown; showFieldIds: string[] }[];
}

export interface SubmitResult {
  received: true;
  taskId: string;
  customId: string;
}

@Injectable()
export class FormSubmissionsService {
  private readonly logger = new Logger(FormSubmissionsService.name);

  constructor(
    @InjectModel(Form.name) private readonly forms: Model<Form>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    private readonly formsService: FormsService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly engine: AutomationEngineService,
  ) {}

  async publicForm(token: string): Promise<PublicFormView> {
    const form = await this.formsService.findByToken(token);

    return {
      id: String(form._id),
      title: form.title,
      description: form.description,
      fields: form.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options.map((option) => ({ id: option.id, label: option.label })),
      })),
      conditions: form.conditions.map((condition) => ({
        fieldId: condition.fieldId,
        op: condition.op,
        value: condition.value,
        showFieldIds: condition.showFieldIds,
      })),
    };
  }

  /**
   * Turns a submission into a task of the List of the form, warns who asked to be
   * warned and fires the `formSubmitted` trigger of the automations of that List.
   */
  async submit(token: string, dto: SubmitFormDto): Promise<SubmitResult> {
    this.requireHuman(dto);

    const form = await this.formsService.findByToken(token);
    const values = this.requireSize(dto.values ?? {});
    const visible = visibleFieldIds(
      form.fields.map((field) => field.id),
      form.conditions,
      values,
    );

    this.requireAnswers(form, values, visible);

    const actor: PermissionContext = {
      workspaceId: form.workspaceId,
      userId: form.createdBy,
      role: 'owner',
    };
    const task = await this.tasks.create(
      actor,
      form.listId,
      await this.taskPrefixOf(form.workspaceId),
      this.toTaskDto(form, values, visible),
    );

    await this.forms.updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } }).exec();
    await this.notify(form, task._id, task.name);
    await this.dispatchAutomations(form, task._id, values);

    return { received: true, taskId: String(task._id), customId: task.customId };
  }

  /** The honeypot has to arrive empty; a filled one is a bot and the submission is dropped. */
  private requireHuman(dto: SubmitFormDto): void {
    if (typeof dto.website === 'string' && dto.website.trim().length > 0) {
      throw new BadRequestException({
        code: 'FORM_SUBMISSION_REJECTED',
        message: 'Envio recusado.',
      });
    }
  }

  private requireSize(values: Record<string, unknown>): Record<string, unknown> {
    if (JSON.stringify(values).length > MAX_SUBMISSION_LENGTH) {
      throw this.invalid('O envio é grande demais.');
    }

    for (const value of Object.values(values)) {
      if (typeof value === 'string' && value.length > MAX_ANSWER_LENGTH) {
        throw this.invalid('Uma das respostas é grande demais.');
      }
    }

    return values;
  }

  private requireAnswers(
    form: FormDocument,
    values: Record<string, unknown>,
    visible: Set<string>,
  ): void {
    for (const field of form.fields) {
      if (!field.required || !visible.has(field.id)) {
        continue;
      }

      const answer = values[field.id];

      if (answer === undefined || answer === null || answer === '') {
        throw this.invalid(`Responda o campo "${field.label}".`);
      }
    }
  }

  /** Builds the task from the mapping of each question plus the defaults of the form. */
  private toTaskDto(
    form: FormDocument,
    values: Record<string, unknown>,
    visible: Set<string>,
  ): CreateTaskDto {
    const dto: CreateTaskDto = { name: form.title };
    const customFields: { fieldId: string; value: unknown }[] = [];
    const unmapped: string[] = [];

    for (const field of form.fields) {
      if (!visible.has(field.id)) {
        continue;
      }

      const answer = values[field.id];

      if (answer === undefined || answer === null || answer === '') {
        continue;
      }

      const customFieldId = field.mapTo ? customFieldIdOf(field.mapTo) : null;

      if (field.mapTo && isCustomFieldTarget(field.mapTo)) {
        if (!customFieldId) {
          throw this.invalid('O formulário aponta para um campo personalizado inválido.');
        }

        customFields.push({ fieldId: String(customFieldId), value: answer });
        continue;
      }

      switch (field.mapTo) {
        case 'name':
          dto.name = this.asText(answer).slice(0, 500);
          break;
        case 'description':
          dto.descriptionText = this.asText(answer);
          break;
        case 'priority':
          dto.priority = this.asPriority(answer);
          break;
        case 'dueAt':
          dto.dueAt = this.asDate(answer);
          break;
        case 'assignee':
          dto.assigneeIds = [this.asObjectId(answer)];
          break;
        default:
          unmapped.push(`${field.label}: ${this.asText(answer)}`);
      }
    }

    if (unmapped.length) {
      dto.descriptionText = [dto.descriptionText, ...unmapped].filter(Boolean).join('\n');
    }

    if (!dto.assigneeIds?.length && form.defaultAssigneeId) {
      dto.assigneeIds = [String(form.defaultAssigneeId)];
    }

    if (form.defaultStatusId) {
      dto.statusId = String(form.defaultStatusId);
    }

    if (customFields.length) {
      dto.customFields = customFields;
    }

    return dto;
  }

  private async notify(form: FormDocument, taskId: Types.ObjectId, name: string): Promise<void> {
    const recipients = (form.notify.length ? form.notify : [form.createdBy]).map((userId) => ({
      userId,
      bucket: 'primary' as const,
    }));

    await this.notifications.deliver({
      workspaceId: form.workspaceId,
      type: 'formSubmitted',
      entityType: 'task',
      entityId: taskId,
      actorId: null,
      recipients,
      data: { formId: String(form._id), formTitle: form.title, taskName: name },
      mail: {
        subject: `Novo envio em ${form.title}`,
        text: `O formulário ${form.title} gerou a tarefa ${name}.`,
      },
    });
  }

  /** A failing automation never fails the submission that produced the task. */
  private async dispatchAutomations(
    form: FormDocument,
    taskId: Types.ObjectId,
    values: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.engine.dispatch(
        {
          workspaceId: form.workspaceId,
          eventId: `formSubmitted:${randomUUID()}`,
          triggerType: 'formSubmitted',
          taskId,
          listId: form.listId,
          actorId: null,
          payload: { formId: String(form._id), ...values },
        },
        null,
      );
    } catch (error) {
      this.logger.error(
        'Falha ao disparar as automações do formulário.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async taskPrefixOf(workspaceId: Types.ObjectId): Promise<string> {
    const workspace = await this.workspaces.findById(workspaceId).select('taskPrefix').exec();

    return workspace?.taskPrefix ?? 'TSK';
  }

  private asText(value: unknown): string {
    return Array.isArray(value) ? value.map((item) => String(item)).join(', ') : String(value);
  }

  private asPriority(value: unknown): TaskPriority {
    const priority = this.asText(value).toLowerCase();

    if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
      throw this.invalid('Prioridade inválida no envio do formulário.');
    }

    return priority as TaskPriority;
  }

  private asDate(value: unknown): string {
    const date = new Date(this.asText(value));

    if (Number.isNaN(date.getTime())) {
      throw this.invalid('Data inválida no envio do formulário.');
    }

    return date.toISOString();
  }

  private asObjectId(value: unknown): string {
    const id = this.asText(value);

    if (!Types.ObjectId.isValid(id)) {
      throw this.invalid('Responsável inválido no envio do formulário.');
    }

    return id;
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_FORM_SUBMISSION', message });
  }
}
