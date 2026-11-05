import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** List as the sidebar tree shows it. */
export class TreeListDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'uSolutionsPDV — Sprint 3' })
  name: string;

  @ApiPropertyOptional({ example: '#A78BFA' })
  color?: string;

  @ApiProperty({ description: 'Ordem manual (fractional indexing).' })
  position: string;

  @ApiProperty({ description: 'Tarefas abertas da List.', example: 8 })
  openTaskCount: number;
}

/** Folder of the tree; it may hold subfolders and Lists. */
export class TreeFolderDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Cênio Construções' })
  name: string;

  @ApiProperty()
  private: boolean;

  @ApiProperty({ description: 'Ordem manual (fractional indexing).' })
  position: string;

  @ApiProperty({ type: () => [TreeFolderDto] })
  folders: TreeFolderDto[];

  @ApiProperty({ type: () => [TreeListDto] })
  lists: TreeListDto[];
}

/** Space of the tree, the root of the sidebar. */
export class TreeSpaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Clientes' })
  name: string;

  @ApiProperty({ example: '#A78BFA' })
  color: string;

  @ApiPropertyOptional({ example: 'folder' })
  icon?: string;

  @ApiProperty()
  private: boolean;

  @ApiProperty({ description: 'Ordem manual (fractional indexing).' })
  position: string;

  @ApiProperty({ type: () => [TreeFolderDto] })
  folders: TreeFolderDto[];

  @ApiProperty({ type: () => [TreeListDto] })
  lists: TreeListDto[];
}

/** Sidebar tree of the workspace, already filtered by permission. */
export class WorkspaceTreeDto {
  @ApiProperty({ type: () => [TreeSpaceDto] })
  spaces: TreeSpaceDto[];
}
