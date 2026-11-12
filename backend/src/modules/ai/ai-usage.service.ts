import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AI_RATE_LIMIT, AI_RATE_WINDOW_MS, AiFeature } from './ai-fields';
import { AiUsage } from './ai-provider';
import { AiUsageEntry } from './schemas/ai-usage.schema';

export interface RecordUsageInput {
  workspaceId: Types.ObjectId;
  /** Null on a run of a scheduled agent. */
  userId: Types.ObjectId | null;
  feature: AiFeature;
  usage: AiUsage;
  model: string;
}

export interface AiUsageSummary {
  from: Date;
  tokensIn: number;
  tokensOut: number;
  total: number;
  /** 0 means no ceiling. */
  budget: number;
}

/**
 * Keeps the AI inside its limits: a monthly token budget per workspace (read from
 * ai_usage) and a per-user rate limit. The window of the rate limit lives in the
 * memory of the process, like the throttle of the public forms.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  private readonly hits = new Map<string, number[]>();

  private readonly budget: number;

  constructor(
    @InjectModel(AiUsageEntry.name) private readonly model: Model<AiUsageEntry>,
    config: ConfigService,
  ) {
    this.budget = Number(config.get<number>('AI_MONTHLY_TOKEN_BUDGET') ?? 0);
  }

  /** Checked before every call that a user pays for. */
  async assertAllowed(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    this.assertRate(userId);
    await this.assertBudget(workspaceId);
  }

  /** The budget also stops the scheduled agents, which have no requester. */
  async assertBudget(workspaceId: Types.ObjectId): Promise<void> {
    if (this.budget <= 0) {
      return;
    }

    const summary = await this.summary(workspaceId);

    if (summary.total >= this.budget) {
      throw new HttpException(
        {
          code: 'AI_BUDGET_EXCEEDED',
          message: 'O orçamento de IA do mês acabou. Fale com um administrador.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  assertRate(userId: Types.ObjectId): void {
    const key = String(userId);
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < AI_RATE_WINDOW_MS);

    if (recent.length >= AI_RATE_LIMIT) {
      throw new HttpException(
        { code: 'AI_RATE_LIMITED', message: 'Muitos pedidos à IA. Tente novamente em instantes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);
  }

  /** Never fails the request: the answer was already produced. */
  async record(input: RecordUsageInput): Promise<void> {
    try {
      await this.model.create({
        workspaceId: input.workspaceId,
        userId: input.userId,
        feature: input.feature,
        tokensIn: input.usage.tokensIn,
        tokensOut: input.usage.tokensOut,
        model: input.model,
      });
    } catch (error) {
      this.logger.error(
        'Falha ao registrar o consumo de IA.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Tokens the workspace spent in the current calendar month. */
  async summary(workspaceId: Types.ObjectId): Promise<AiUsageSummary> {
    const from = this.monthStart();
    const [totals] = await this.model
      .aggregate<{ tokensIn: number; tokensOut: number }>([
        { $match: { workspaceId, createdAt: { $gte: from } } },
        {
          $group: {
            _id: null,
            tokensIn: { $sum: '$tokensIn' },
            tokensOut: { $sum: '$tokensOut' },
          },
        },
      ])
      .exec();

    const tokensIn = totals?.tokensIn ?? 0;
    const tokensOut = totals?.tokensOut ?? 0;

    return { from, tokensIn, tokensOut, total: tokensIn + tokensOut, budget: this.budget };
  }

  private monthStart(): Date {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
