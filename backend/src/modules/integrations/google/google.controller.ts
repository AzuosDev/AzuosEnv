import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Public } from '../../../common/decorators/public.decorator';
import { permissionContextFrom } from '../../hierarchy/permission.service';
import { CurrentMembership } from '../../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RequestMembership } from '../../workspaces/workspace-context';
import { GoogleOAuthService, GoogleStatus } from './google-oauth.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/integrations/google')
export class GoogleIntegrationController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  @Get()
  @ApiOkResponse({ description: 'Situação da conta do Google deste usuário.' })
  status(@CurrentMembership() membership: RequestMembership): Promise<GoogleStatus> {
    const ctx = permissionContextFrom(membership);

    return this.oauth.status(ctx.workspaceId, ctx.userId);
  }

  @Post('auth-url')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'URL de consentimento do Google.' })
  authUrl(@CurrentMembership() membership: RequestMembership): { url: string } {
    const ctx = permissionContextFrom(membership);

    return { url: this.oauth.authUrl(ctx.workspaceId, ctx.userId) };
  }

  @Delete()
  @ApiOkResponse({ description: 'Conta desconectada.' })
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
  @ApiOkResponse({ description: 'Conta conectada.' })
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
