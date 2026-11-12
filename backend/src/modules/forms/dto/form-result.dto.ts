import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FORM_CONDITION_OPS,
  FORM_FIELD_TYPES,
  FormConditionOp,
  FormFieldType,
} from '../form-fields';
import { Form } from '../schemas/form.schema';

/** Resposta de POST /forms: o token público aparece uma única vez. */
export class FormResultDto {
  @ApiProperty({ type: Form })
  form: Form;

  @ApiProperty({ nullable: true, description: 'Token do link público, só na criação.' })
  token: string | null;

  @ApiProperty({ nullable: true, description: 'URL pública do formulário, só na criação.' })
  url: string | null;
}

export class PublicFormFieldOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;
}

export class PublicFormFieldDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES })
  type: FormFieldType;

  @ApiProperty()
  required: boolean;

  @ApiProperty({ type: [PublicFormFieldOptionDto] })
  options: PublicFormFieldOptionDto[];
}

export class PublicFormConditionDto {
  @ApiProperty()
  fieldId: string;

  @ApiProperty({ enum: FORM_CONDITION_OPS })
  op: FormConditionOp;

  @ApiPropertyOptional({ description: 'Valor comparado; JSON livre.' })
  value?: unknown;

  @ApiProperty({ type: [String] })
  showFieldIds: string[];
}

/** Resposta de GET /public/forms/:token: sem mapTo e sem dado do workspace. */
export class PublicFormDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: [PublicFormFieldDto] })
  fields: PublicFormFieldDto[];

  @ApiProperty({ type: [PublicFormConditionDto] })
  conditions: PublicFormConditionDto[];
}

/** Resposta de POST /public/forms/:token/submit. */
export class SubmitFormResultDto {
  @ApiProperty({ example: true })
  received: boolean;

  @ApiProperty()
  taskId: string;

  @ApiProperty({ example: 'AZD-150' })
  customId: string;
}
