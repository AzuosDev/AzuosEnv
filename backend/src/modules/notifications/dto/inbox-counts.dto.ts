import { ApiProperty } from '@nestjs/swagger';

/** Unread entries of each inbox tab, plus the totals of snoozed and cleared. */
export class InboxCountsDto {
  @ApiProperty({ description: 'Não lidas da aba principal.', example: 2 })
  primary: number;

  @ApiProperty({ description: 'Não lidas da aba Outros.', example: 0 })
  other: number;

  @ApiProperty({ description: 'Total da aba Depois (adiadas).', example: 0 })
  later: number;

  @ApiProperty({ description: 'Total da aba Limpas.', example: 0 })
  cleared: number;

  @ApiProperty({ description: 'Não lidas somando principal e Outros.', example: 2 })
  unread: number;
}
