import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Audit } from '../../audit/audit.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { SuccessDto } from '../../../common/dto/api-error.dto';
import { ApiWorkspaceParam } from '../../../common/swagger/api-workspace-param.decorator';
import { permissionContextFrom } from '../../hierarchy/permission.service';
import { CurrentMembership } from '../../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RequestMembership } from '../../workspaces/workspace-context';
import {
  GoogleAuthUrlResultDto,
  GoogleCalendarsResultDto,
  GoogleCallbackResultDto,
  GoogleStatusResultDto,
} from './dto/google-result.dto';
import { ChooseCalendarDto } from './dto/google.dto';
import { GoogleCalendar, GoogleOAuthService, GoogleStatus } from './google-oauth.service';

@ApiTags('integrations')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/integrations/google')
export class GoogleIntegrationController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  @Get()
  @ApiOkResponse({
    description: 'Situação da conta do Google deste usuário.',
    type: GoogleStatusResultDto,
  })
  status(@CurrentMembership() membership: RequestMembership): Promise<GoogleStatus> {
    const ctx = permissionContextFrom(membership);

    return this.oauth.status(ctx.workspaceId, ctx.userId);
  }

  @Post('auth-url')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'URL de consentimento do Google.', type: GoogleAuthUrlResultDto })
  authUrl(@CurrentMembership() membership: RequestMembership): { url: string } {
    const ctx = permissionContextFrom(membership);

    return { url: this.oauth.authUrl(ctx.workspaceId, ctx.userId) };
  }

  @Get('calendars')
  @ApiOkResponse({
    description: 'Agendas da conta conectada.',
    type: GoogleCalendarsResultDto,
  })
  async calendars(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ items: GoogleCalendar[] }> {
    const ctx = permissionContextFrom(membership);

    return { items: await this.oauth.calendars(ctx.workspaceId, ctx.userId) };
  }

  @Patch()
  @Audit('integration.google.calendar.changed', 'integration')
  @ApiOkResponse({ description: 'Agenda escolhida.', type: GoogleStatusResultDto })
  chooseCalendar(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: ChooseCalendarDto,
  ): Promise<GoogleStatus> {
    const ctx = permissionContextFrom(membership);

    return this.oauth.chooseCalendar(ctx.workspaceId, ctx.userId, dto.calendarId);
  }

  @Delete()
  @Audit('integration.google.disconnected', 'integration')
  @ApiOkResponse({ description: 'Conta desconectada.', type: SuccessDto })
  async disconnect(@CurrentMembership() membership: RequestMembership): Promise<{ success: true }> {
    const ctx = permissionContextFrom(membership);

    await this.oauth.disconnect(ctx.workspaceId, ctx.userId);

    return { success: true };
  }
}

/** Redirect target of the consent screen; the state carries who is connecting. */
@ApiTags('integrations')
@Controller('integrations/google')
export class GoogleCallbackController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  @Public()
  @Get('callback')
  @ApiOkResponse({ description: 'Conta conectada.', type: GoogleCallbackResultDto })
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<{ connected: true; email: string | null; workspaceId: string }> {
    if (error) {
      throw new BadRequestException({
        code: 'INVALID_GOOGLE_INTEGRATION',
        message: `O Google recusou o consentimento (${error}).`,
      });
    }

    if (!code || !state) {
      throw new BadRequestException({
        code: 'INVALID_GOOGLE_INTEGRATION',
        message: 'A resposta do Google veio sem code ou state.',
      });
    }

    const connection = await this.oauth.handleCallback(code, state);

    return {
      connected: true,
      email: connection.email,
      workspaceId: String(connection.workspaceId as Types.ObjectId),
    };
  }
}
