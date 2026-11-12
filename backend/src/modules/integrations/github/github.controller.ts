import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { SuccessDto } from '../../../common/dto/api-error.dto';
import { ApiWorkspaceParam } from '../../../common/swagger/api-workspace-param.decorator';
import { Audit } from '../../audit/audit.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { RawBodyRequest } from '../../../app.setup';
import { permissionContextFrom } from '../../hierarchy/permission.service';
import { Roles } from '../../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RequestMembership } from '../../workspaces/workspace-context';
import { GithubIntegrationResultDto, GithubIntegrationsResultDto } from './dto/github-result.dto';
import { CreateGithubIntegrationDto, UpdateGithubIntegrationDto } from './dto/github.dto';
import { GITHUB_EVENT_HEADER, GITHUB_SIGNATURE_HEADER } from './github-fields';
import { GithubIntegrationWithSecret, GithubService, GithubWebhookResult } from './github.service';
import { GithubIntegrationDocument } from './schemas/github-integration.schema';

@ApiTags('integrations')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Roles('admin')
@Controller('workspaces/:wsId/integrations/github')
export class GithubIntegrationsController {
  constructor(private readonly github: GithubService) {}

  @Post()
  @Audit('integration.github.created', 'integration')
  @ApiCreatedResponse({
    description: 'Repositório ligado; o secret aparece só aqui.',
    type: GithubIntegrationResultDto,
  })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateGithubIntegrationDto,
  ): Promise<GithubIntegrationWithSecret> {
    return this.github.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'Repositórios ligados e a URL do webhook.',
    type: GithubIntegrationsResultDto,
  })
  list(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ items: GithubIntegrationDocument[]; webhookUrl: string }> {
    return this.github.list(permissionContextFrom(membership));
  }

  @Patch(':integrationId')
  @Audit('integration.github.updated', 'integration', 'integrationId')
  @ApiOkResponse({ description: 'Integração atualizada.', type: GithubIntegrationResultDto })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('integrationId', ParseObjectIdPipe) integrationId: Types.ObjectId,
    @Body() dto: UpdateGithubIntegrationDto,
  ): Promise<GithubIntegrationWithSecret> {
    return this.github.update(permissionContextFrom(membership), integrationId, dto);
  }

  @Delete(':integrationId')
  @Audit('integration.github.deleted', 'integration', 'integrationId')
  @ApiOkResponse({ description: 'Integração removida.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('integrationId', ParseObjectIdPipe) integrationId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.github.remove(permissionContextFrom(membership), integrationId);

    return { success: true };
  }
}

/**
 * Public entry point of GitHub. The repository of the payload picks the mapping and
 * the signature is verified over the raw body; a wrong one answers 401.
 */
@ApiTags('integrations')
@Controller('integrations/github')
export class GithubWebhookController {
  constructor(private readonly github: GithubService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Evento aceito.' })
  receive(
    @Req() request: RawBodyRequest,
    @Headers(GITHUB_SIGNATURE_HEADER) signature: string | undefined,
    @Headers(GITHUB_EVENT_HEADER) event: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<GithubWebhookResult> {
    return this.github.handleWebhook({
      rawBody: request.rawBody,
      signature,
      event,
      body: body && typeof body === 'object' ? body : {},
    });
  }
}
