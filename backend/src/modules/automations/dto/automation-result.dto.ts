import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONDITION_OPS, ConditionOp } from '../automation-conditions';
import {
  ACTION_TYPES,
  AUTOMATION_LOCATION_TYPES,
  ActionType,
  AutomationLocationType,
  TRIGGER_TYPES,
  TriggerType,
} from '../automation-fields';
import { Automation } from '../schemas/automation.schema';

/** Resposta de POST e PATCH /automations; o secret do hook aparece uma única vez. */
export class AutomationResultDto {
  @ApiProperty({ type: Automation })
  automation: Automation;

  @ApiPropertyOptional({ description: 'Segredo do hook, mostrado só na criação ou ao girar.' })
  webhookSecret?: string;

  @ApiPropertyOptional({ description: 'URL pública do hook, com o segredo embutido.' })
  webhookUrl?: string;
}

export class AutomationRecipeTriggerDto {
  @ApiProperty({ enum: TRIGGER_TYPES })
  type: TriggerType;

  @ApiProperty({ type: 'object', additionalProperties: true })
  params: Record<string, unknown>;
}

export class AutomationRecipeConditionDto {
  @ApiProperty()
  field: string;

  @ApiProperty({ enum: CONDITION_OPS })
  op: ConditionOp;

  @ApiPropertyOptional({ description: 'Valor comparado; JSON livre.' })
  value?: unknown;
}

export class AutomationRecipeActionDto {
  @ApiProperty({ enum: ACTION_TYPES })
  type: ActionType;

  @ApiProperty({ type: 'object', additionalProperties: true })
  params: Record<string, unknown>;
}

/** Receita pronta: o corpo do POST /automations com lacunas a preencher. */
export class AutomationRecipeDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: AUTOMATION_LOCATION_TYPES, isArray: true })
  locationTypes: AutomationLocationType[];

  @ApiProperty({ type: AutomationRecipeTriggerDto })
  trigger: AutomationRecipeTriggerDto;

  @ApiProperty({ type: [AutomationRecipeConditionDto] })
  conditions: AutomationRecipeConditionDto[];

  @ApiProperty({ type: [AutomationRecipeActionDto] })
  actions: AutomationRecipeActionDto[];

  @ApiProperty({
    type: [String],
    description: 'Caminhos que o usuário precisa preencher, como actions.0.params.userIds.',
  })
  requires: string[];
}

export class AutomationRecipesDto {
  @ApiProperty({ type: [AutomationRecipeDto] })
  items: AutomationRecipeDto[];
}

/**
 * Resposta de POST /templates/:id/apply: o recurso criado (Space, Folder, List,
 * tarefa, checklist ou view), já no formato JSON do documento.
 */
export class AppliedTemplateDto {
  @ApiProperty({ description: 'Id do recurso criado.' })
  id: string;

  @ApiProperty({ description: 'Nome do recurso criado.' })
  name: string;
}
