import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ChooseCalendarDto {
  @ApiProperty({ description: 'Agenda do Google que a sincronização usa.', example: 'primary' })
  @IsString()
  @Length(1, 320)
  calendarId: string;
}
