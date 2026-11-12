import { ApiProperty } from '@nestjs/swagger';

export class SkippedRowDto {
  @ApiProperty({ description: 'Linha do arquivo; o cabeçalho é a linha 1.' })
  line: number;

  @ApiProperty({ example: 'LINHA SEM NOME DE TAREFA' })
  reason: string;
}

export class ImportReportDto {
  @ApiProperty({ description: 'Linhas lidas do arquivo.' })
  rows: number;

  @ApiProperty({ description: 'Tarefas criadas.' })
  tasks: number;

  @ApiProperty({ description: 'Lists criadas.' })
  lists: number;

  @ApiProperty({ description: 'Folders criadas.' })
  folders: number;

  @ApiProperty({ description: 'Tags criadas.' })
  tags: number;

  @ApiProperty({ type: [SkippedRowDto], description: 'Linhas que não entraram.' })
  skipped: SkippedRowDto[];

  @ApiProperty({ type: [SkippedRowDto], description: 'Linhas importadas com algum ajuste.' })
  warnings: SkippedRowDto[];
}

export class WorkspaceExportResultDto {
  @ApiProperty({ format: 'date-time' })
  exportedAt: string;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  workspace: Record<string, unknown>;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Nome e e-mail de quem participa do workspace.',
  })
  users: Record<string, unknown>[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'object', additionalProperties: true } },
    description: 'Documentos de cada coleção do workspace.',
  })
  collections: Record<string, Record<string, unknown>[]>;

  @ApiProperty({ type: [String], description: 'Coleções cortadas no limite do export.' })
  truncated: string[];
}
