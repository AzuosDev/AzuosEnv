import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AiAgentRunnerService } from './ai-agent-runner.service';
import { AiAgentsService } from './ai-agents.service';
import { AI_AGENTS_CHANGED } from './ai-events';
import { AiAgentDocument } from './schemas/ai-agent.schema';

const JOB_PREFIX = 'ai-agent:';

/**
 * One dynamic cron job per active agent, registered in the SchedulerRegistry and
 * rebuilt whenever an agent is written. Same shape as the automations scheduler.
 */
@Injectable()
export class AiAgentsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiAgentsScheduler.name);

  constructor(
    private readonly agents: AiAgentsService,
    private readonly runner: AiAgentRunnerService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncJobs();
  }

  onModuleDestroy(): void {
    this.clearJobs();
  }

  @OnEvent(AI_AGENTS_CHANGED)
  async onAgentsChanged(): Promise<void> {
    await this.syncJobs();
  }

  private async syncJobs(): Promise<void> {
    this.clearJobs();

    for (const agent of await this.agents.active()) {
      try {
        const job = CronJob.from({
          cronTime: agent.cron,
          timeZone: typeof agent.config.timezone === 'string' ? agent.config.timezone : undefined,
          start: false,
          onTick: () => {
            void this.runSafely(agent);
          },
        });

        this.registry.addCronJob(`${JOB_PREFIX}${String(agent._id)}`, job);
        job.start();
      } catch (error) {
        this.logger.warn(
          `Cron inválido no agente ${String(agent._id)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async runSafely(agent: AiAgentDocument): Promise<void> {
    try {
      await this.runner.run(agent);
    } catch (error) {
      this.logger.error(
        `Falha no agente ${String(agent._id)}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private clearJobs(): void {
    const names = [...this.registry.getCronJobs().keys()].filter((name) =>
      name.startsWith(JOB_PREFIX),
    );

    for (const name of names) {
      this.registry.deleteCronJob(name);
    }
  }
}
