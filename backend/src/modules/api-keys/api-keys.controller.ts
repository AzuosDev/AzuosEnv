import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiKeysService, CreatedApiKey } from './api-keys.service';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { ApiKeyDocument } from './schemas/api-key.schema';

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('users/me/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Chave criada; o token aparece só nesta resposta.' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    return this.apiKeys.create(userId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Chaves do usuário, mais novas primeiro.' })
  async list(@CurrentUser('id') userId: string): Promise<{ items: ApiKeyDocument[] }> {
    return { items: await this.apiKeys.list(userId) };
  }

  @Delete(':apiKeyId')
  @ApiOkResponse({ description: 'Chave revogada.' })
  async revoke(
    @CurrentUser('id') userId: string,
    @Param('apiKeyId', ParseObjectIdPipe) apiKeyId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.apiKeys.revoke(userId, apiKeyId);

    return { success: true };
  }
}
