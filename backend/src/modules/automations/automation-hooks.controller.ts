import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationsService } from './automations.service';

/**
 * Public entry point of the `webhookReceived` and `formSubmitted` triggers. The
 * secret is stored hashed and a wrong one answers 404, so the route never tells a
 * caller whether the automation exists.
 */
@ApiTags('automations')
@Controller('hooks')
export class AutomationHooksController {
  constructor(
    private readonly automations: AutomationsService,
    private readonly engine: AutomationEngineService,
  ) {}

  @Public()
  @Post(':automationId/:secret')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Evento aceito; a automação roda em seguida.' })
  async receive(
    @Param('automationId') automationId: string,
    @Param('secret') secret: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ received: true }> {
    const automation = await this.automations.findByHook(automationId, secret);

    if (!automation) {
      throw new NotFoundException({
        code: 'AUTOMATION_NOT_FOUND',
        message: 'Hook não encontrado.',
      });
    }

    const payload = body && typeof body === 'object' ? body : {};
    const taskId = payload.taskId;

    await this.engine.dispatchTo(automation, {
      workspaceId: automation.workspaceId,
      eventId: `${automation.trigger.type}:${randomUUID()}`,
      triggerType: automation.trigger.type,
      taskId:
        typeof taskId === 'string' && Types.ObjectId.isValid(taskId)
          ? new Types.ObjectId(taskId)
          : null,
      listId: automation.locationType === 'list' ? automation.locationId : null,
      actorId: null,
      payload,
    });

    return { received: true };
  }
}
