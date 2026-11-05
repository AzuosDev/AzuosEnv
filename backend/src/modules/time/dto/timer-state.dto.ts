import { ApiProperty } from '@nestjs/swagger';
import { TimeEntry } from '../schemas/time-entry.schema';

/** Resposta de GET /time/timer/current: o cronômetro aberto, se houver. */
export class TimerStateDto {
  @ApiProperty({
    type: TimeEntry,
    nullable: true,
    description: 'Lançamento em andamento do usuário; null quando não há cronômetro.',
  })
  entry: TimeEntry | null;
}

/** Resposta de POST /time/timer/start: o novo cronômetro e o que ele parou. */
export class TimerResultDto {
  @ApiProperty({ type: TimeEntry, description: 'Cronômetro iniciado.' })
  entry: TimeEntry;

  @ApiProperty({
    type: TimeEntry,
    nullable: true,
    description: 'Cronômetro anterior, que este start parou; null quando não havia nenhum.',
  })
  stopped: TimeEntry | null;
}
