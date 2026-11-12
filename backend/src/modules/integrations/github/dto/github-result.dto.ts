import { ApiProperty } from '@nestjs/swagger';
import { GithubIntegration } from '../schemas/github-integration.schema';

export class GithubIntegrationResultDto {
  @ApiProperty({ type: GithubIntegration, description: 'Mapeamento repositório → workspace.' })
  integration: GithubIntegration;

  @ApiProperty({
    nullable: true,
    description: 'Secret em claro; só aparece quando o servidor o gera ou o troca.',
    example: 'a1b2c3',
  })
  secret: string | null;

  @ApiProperty({ description: 'URL que o repositório deve chamar.' })
  webhookUrl: string;
}

export class GithubIntegrationsResultDto {
  @ApiProperty({ type: [GithubIntegration], description: 'Repositórios ligados.' })
  items: GithubIntegration[];

  @ApiProperty({ description: 'URL que os repositórios devem chamar.' })
  webhookUrl: string;
}
