import { ApiProperty } from '@nestjs/swagger';
import { ApiKey } from '../schemas/api-key.schema';

export class ApiKeysResultDto {
  @ApiProperty({ type: [ApiKey], description: 'Chaves do usuário, mais novas primeiro.' })
  items: ApiKey[];
}

export class CreatedApiKeyResultDto {
  @ApiProperty({ type: ApiKey, description: 'Chave criada.' })
  apiKey: ApiKey;

  @ApiProperty({ description: 'Token em claro; só aparece nesta resposta.', example: 'azk_3f0c' })
  token: string;
}
