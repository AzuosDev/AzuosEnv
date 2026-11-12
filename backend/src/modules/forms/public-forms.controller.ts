import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PublicFormDto, SubmitFormResultDto } from './dto/form-result.dto';
import { SubmitFormDto } from './dto/form-submission.dto';
import { SUBMIT_THROTTLE } from './form-fields';
import { FormSubmissionsService, PublicFormView, SubmitResult } from './form-submissions.service';

/**
 * Public face of a form, open to the origins of PUBLIC_FORM_ORIGINS. The token is
 * stored only as a sha256 and a wrong or inactive one answers 404. Submissions are
 * capped at five per minute per IP and carry a honeypot field.
 */
@ApiTags('forms')
@Controller('public/forms')
export class PublicFormsController {
  constructor(private readonly submissions: FormSubmissionsService) {}

  @Public()
  @Get(':token')
  @ApiOkResponse({ description: 'Formulário público, somente leitura.', type: PublicFormDto })
  read(@Param('token') token: string): Promise<PublicFormView> {
    return this.submissions.publicForm(token);
  }

  @Public()
  @Throttle(SUBMIT_THROTTLE)
  @Post(':token/submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Envio aceito; a tarefa é criada na List do formulário.',
    type: SubmitFormResultDto,
  })
  submit(@Param('token') token: string, @Body() dto: SubmitFormDto): Promise<SubmitResult> {
    return this.submissions.submit(token, dto);
  }
}
