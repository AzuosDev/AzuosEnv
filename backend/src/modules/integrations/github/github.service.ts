import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { CommentsService } from '../../collaboration/comments.service';
import { HierarchyAccessService } from '../../hierarchy/hierarchy-access.service';
import { StatusSetsService } from '../../hierarchy/status-sets.service';
import { PermissionContext } from '../../hierarchy/permission.service';
import { Task, TaskDocument } from '../../tasks/schemas/task.schema';
import { TasksService } from '../../tasks/tasks.service';
import { Workspace } from '../../workspaces/schemas/workspace.schema';
import { SecretsService } from '../../secrets/secrets.service';
import { verifyBody } from '../webhooks/webhook-signature';
import { CreateGithubIntegrationDto, UpdateGithubIntegrationDto } from './dto/github.dto';
import {
  DEFAULT_DEPLOY_STATUS,
  DEFAULT_REVIEW_STATUS,
  GITHUB_SECRET_BYTES,
  GithubOutcome,
} from './github-fields';
import {
  PullRequestInfo,
  outcomeOf,
  pullRequestComment,
  readPullRequest,
  taskRefOf,
} from './github-payload';
import { GithubIntegration, GithubIntegrationDocument } from './schemas/github-integration.schema';

export interface GithubIntegrationWithSecret {
  integration: GithubIntegrationDocument;
  /** Shown only when the secret is generated or rotated. */
  secret: string | null;
  webhookUrl: string;
}

export interface GithubWebhookResult {
  received: true;
  /** Why nothing happened, when the event was accepted but not applied. */
  ignored?: string;
  taskId?: string;
  customId?: string;
  outcome?: GithubOutcome;
  statusChanged?: boolean;
}

export interface GithubWebhookRequest {
  rawBody: Buffer | undefined;
  signature: string | undefined;
  event: string | undefined;
  body: Record<string, unknown>;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    @InjectModel(GithubIntegration.name) private readonly model: Model<GithubIntegration>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    private readonly tasksService: TasksService,
    private readonly comments: CommentsService,
    private readonly hierarchy: HierarchyAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService,
  ) {}

  async create(
    ctx: PermissionContext,
    dto: CreateGithubIntegrationDto,
  ): Promise<GithubIntegrationWithSecret> {
    const repository = dto.repository.toLowerCase();
    const taken = await this.model.countDocuments({ repository }).exec();

    if (taken > 0) {
      throw new ConflictException({
        code: 'GITHUB_REPOSITORY_IN_USE',
        message: 'Este repositório já está ligado a um workspace.',
      });
    }

    const secret = dto.secret ?? randomBytes(GITHUB_SECRET_BYTES).toString('base64url');
    const integration = await this.model.create({
      workspaceId: ctx.workspaceId,
      repository,
      secret: this.secrets.encrypt(secret),
      reviewStatusName: dto.reviewStatusName ?? DEFAULT_REVIEW_STATUS,
      deployStatusName: dto.deployStatusName ?? DEFAULT_DEPLOY_STATUS,
      active: true,
      createdBy: ctx.userId,
    });

    return { integration, secret, webhookUrl: this.webhookUrl() };
  }

  async list(
    ctx: PermissionContext,
  ): Promise<{ items: GithubIntegrationDocument[]; webhookUrl: string }> {
    return {
      items: await this.model.find({ workspaceId: ctx.workspaceId }).sort({ _id: -1 }).exec(),
      webhookUrl: this.webhookUrl(),
    };
  }

  async get(
    ctx: PermissionContext,
    integrationId: Types.ObjectId,
  ): Promise<GithubIntegrationDocument> {
    const integration = await this.model
      .findOne({ _id: integrationId, workspaceId: ctx.workspaceId })
      .exec();

    if (!integration) {
      throw this.notFound();
    }

    return integration;
  }

  async update(
    ctx: PermissionContext,
    integrationId: Types.ObjectId,
    dto: UpdateGithubIntegrationDto,
  ): Promise<GithubIntegrationWithSecret> {
    const integration = await this.get(ctx, integrationId);
    let secret: string | null = null;

    if (dto.reviewStatusName !== undefined) {
      integration.reviewStatusName = dto.reviewStatusName;
    }

    if (dto.deployStatusName !== undefined) {
      integration.deployStatusName = dto.deployStatusName;
    }

    if (dto.active !== undefined) {
      integration.active = dto.active;
    }

    if (dto.rotateSecret) {
      secret = randomBytes(GITHUB_SECRET_BYTES).toString('base64url');
      integration.secret = this.secrets.encrypt(secret);
    }

    await integration.save();

    return { integration, secret, webhookUrl: this.webhookUrl() };
  }

  async remove(ctx: PermissionContext, integrationId: Types.ObjectId): Promise<void> {
    const integration = await this.get(ctx, integrationId);

    await this.model.deleteOne({ _id: integration._id }).exec();
  }

  /**
   * Entry point of the webhook. The repository of the payload picks the mapping,
   * the signature is checked against the secret of that mapping and only then the
   * task is touched.
   */
  async handleWebhook(request: GithubWebhookRequest): Promise<GithubWebhookResult> {
    const info = readPullRequest(request.body);

    if (!info) {
      throw this.notFound();
    }

    const query = this.model.findOne({ repository: info.repository });

    // `select` apart from the chain keeps the document type intact (Mongoose 9).
    query.select('+secret');

    const integration = await query.exec();

    if (!integration) {
      throw this.notFound();
    }

    const secret = this.secrets.tryDecrypt(integration.secret);

    if (!secret || !request.rawBody || !verifyBody(request.rawBody, secret, request.signature)) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Assinatura do webhook inválida.',
      });
    }

    await this.model
      .updateOne({ _id: integration._id }, { $set: { lastEventAt: new Date() } })
      .exec();

    if (!integration.active) {
      return { received: true, ignored: 'integration-inactive' };
    }

    if ((request.event ?? '') !== 'pull_request') {
      return { received: true, ignored: 'event-not-handled' };
    }

    const outcome = outcomeOf(info);

    if (!outcome) {
      return { received: true, ignored: 'action-not-handled' };
    }

    return this.applyToTask(integration, info, outcome);
  }

  private async applyToTask(
    integration: GithubIntegrationDocument,
    info: PullRequestInfo,
    outcome: GithubOutcome,
  ): Promise<GithubWebhookResult> {
    const workspace = await this.workspaces
      .findOne({ _id: integration.workspaceId, deletedAt: null })
      .exec();

    if (!workspace) {
      return { received: true, ignored: 'workspace-not-found' };
    }

    const customId = taskRefOf(info, workspace.taskPrefix);

    if (!customId) {
      return { received: true, ignored: 'task-not-referenced' };
    }

    const task = await this.tasks
      .findOne({ workspaceId: workspace._id, customId, deletedAt: null })
      .exec();

    if (!task) {
      return { received: true, ignored: 'task-not-found', customId };
    }

    // The integration acts as whoever configured it, like the automation engine.
    const ctx: PermissionContext = {
      workspaceId: workspace._id,
      userId: integration.createdBy,
      role: 'owner',
    };
    const statusId = await this.statusIdFor(ctx, task, integration, outcome);

    if (statusId) {
      await this.tasksService.update(ctx, String(task._id), { statusId });
    }

    if (outcome === 'review') {
      await this.comments
        .create(ctx, String(task._id), { bodyText: pullRequestComment(info, outcome) })
        .catch((error: unknown) => {
          this.logger.warn(
            `Não foi possível comentar o PR na tarefa ${customId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
    }

    return {
      received: true,
      taskId: String(task._id),
      customId,
      outcome,
      statusChanged: statusId !== null,
    };
  }

  /** Status of the List whose name matches the one configured for the outcome. */
  private async statusIdFor(
    ctx: PermissionContext,
    task: TaskDocument,
    integration: GithubIntegrationDocument,
    outcome: GithubOutcome,
  ): Promise<string | null> {
    const wanted = (
      outcome === 'review' ? integration.reviewStatusName : integration.deployStatusName
    )
      .trim()
      .toLowerCase();
    const list = await this.hierarchy.requireList(ctx, task.listId, 'view');
    const effective = await this.statusSets.resolveForList(list);
    const status = effective.statuses.find((one) => one.name.trim().toLowerCase() === wanted);

    if (!status) {
      this.logger.warn(`A List da tarefa ${task.customId} não tem o status "${wanted}" do GitHub.`);

      return null;
    }

    return String(status._id);
  }

  private webhookUrl(): string {
    const base = (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');

    return `${base}/api/v1/integrations/github/webhook`;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'GITHUB_INTEGRATION_NOT_FOUND',
      message: 'Integração do GitHub não encontrada.',
    });
  }
}
