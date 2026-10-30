import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateReminderDto, ReminderQueryDto, UpdateReminderDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';
import { ReminderDocument } from './schemas/reminder.schema';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Lembrete criado para quem chamou.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateReminderDto,
  ): Promise<ReminderDocument> {
    return this.reminders.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Lembretes do usuário, do mais recente ao mais antigo.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ReminderQueryDto,
  ): Promise<CursorPage<ReminderDocument>> {
    return this.reminders.list(permissionContextFrom(membership), query);
  }

  @Get(':reminderId')
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('reminderId', ParseObjectIdPipe) reminderId: Types.ObjectId,
  ): Promise<ReminderDocument> {
    return this.reminders.get(permissionContextFrom(membership), reminderId);
  }

  @Patch(':reminderId')
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('reminderId', ParseObjectIdPipe) reminderId: Types.ObjectId,
    @Body() dto: UpdateReminderDto,
  ): Promise<ReminderDocument> {
    return this.reminders.update(permissionContextFrom(membership), reminderId, dto);
  }

  @Delete(':reminderId')
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('reminderId', ParseObjectIdPipe) reminderId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.reminders.remove(permissionContextFrom(membership), reminderId);

    return { success: true };
  }
}
