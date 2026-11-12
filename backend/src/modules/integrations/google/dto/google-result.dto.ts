import { ApiProperty } from '@nestjs/swagger';

export class GoogleStatusResultDto {
  @ApiProperty({ description: 'Conta do Google conectada neste workspace.' })
  connected: boolean;

  @ApiProperty({ nullable: true, example: 'pessoa@azuos.dev' })
  email: string | null;

  @ApiProperty({ nullable: true, description: 'Agenda escolhida.', example: 'primary' })
  calendarId: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  syncedAt: Date | null;

  @ApiProperty({ description: 'False quando o servidor não tem credencial do Google.' })
  available: boolean;
}

export class GoogleAuthUrlResultDto {
  @ApiProperty({ description: 'URL da tela de consentimento.' })
  url: string;
}

export class GoogleCalendarDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Agenda principal da conta.' })
  primary: boolean;

  @ApiProperty({ description: 'A conta pode gravar eventos nela.' })
  writable: boolean;
}

export class GoogleCalendarsResultDto {
  @ApiProperty({ type: [GoogleCalendarDto], description: 'Agendas da conta conectada.' })
  items: GoogleCalendarDto[];
}

export class GoogleCallbackResultDto {
  @ApiProperty({ example: true })
  connected: true;

  @ApiProperty({ nullable: true, example: 'pessoa@azuos.dev' })
  email: string | null;

  @ApiProperty()
  workspaceId: string;
}
