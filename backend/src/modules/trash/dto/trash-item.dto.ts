import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TRASH_ENTITY_TYPES, TrashEntityType } from '../trash-fields';

/** Um item da lixeira ou do arquivo. */
export class TrashItemDto {
  @ApiProperty({ enum: TRASH_ENTITY_TYPES })
  entityType: TrashEntityType;

  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'uSolutionsPDV — Sprint 3' })
  name: string;

  @ApiProperty({
    description: 'deletedAt na lixeira, archivedAt no arquivo.',
    format: 'date-time',
  })
  at: string;

  @ApiPropertyOptional({ example: 'AZD-142' })
  customId?: string;

  @ApiPropertyOptional()
  spaceId?: string;

  @ApiPropertyOptional({ nullable: true })
  folderId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  parentFolderId?: string | null;

  @ApiPropertyOptional()
  listId?: string;

  @ApiPropertyOptional({ nullable: true })
  parentTaskId?: string | null;
}

/**
 * O restore devolve o próprio documento do item (Space, Folder, List ou tarefa);
 * o contrato declara só o que é comum aos quatro.
 */
export class RestoredEntityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}
