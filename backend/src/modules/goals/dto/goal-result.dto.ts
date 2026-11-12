import { ApiProperty } from '@nestjs/swagger';
import { Goal } from '../schemas/goal.schema';
import { Target } from '../schemas/target.schema';

/** Resposta das rotas de alvo: o alvo e o percentual dele. */
export class TargetResultDto {
  @ApiProperty({ type: Target })
  target: Target;

  @ApiProperty({ description: 'Percentual de 0 a 100 do alvo.' })
  progress: number;
}

/** Resposta de GET /goals/:goalId/targets. */
export class TargetsResultDto {
  @ApiProperty({ type: [TargetResultDto] })
  items: TargetResultDto[];
}

/** Meta com os alvos e o progresso médio deles. */
export class GoalViewDto {
  @ApiProperty({ type: Goal })
  goal: Goal;

  @ApiProperty({ type: [Target] })
  targets: Target[];

  @ApiProperty({ description: 'Percentual de 0 a 100 da meta.' })
  progress: number;
}
