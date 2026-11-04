import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { DocsService, PublicDocView } from './docs.service';

/**
 * Public read-only entry point of a shared Doc. The token is stored only as a
 * sha256 and a wrong one answers 404, so the route never reveals a Doc.
 */
@ApiTags('docs')
@Controller('public/docs')
export class PublicDocsController {
  constructor(private readonly docs: DocsService) {}

  @Public()
  @Get(':token')
  @ApiOkResponse({ description: 'Doc compartilhado, somente leitura.' })
  read(@Param('token') token: string): Promise<PublicDocView> {
    return this.docs.publicDoc(token);
  }
}
