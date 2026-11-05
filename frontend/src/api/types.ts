import type { components } from './schema';

/**
 * Convenção da API: toda resposta de documento também traz id, createdAt e
 * updatedAt (está na descrição do contrato), que o Swagger não declara nos
 * modelos do Mongoose.
 */
export type Doc<T> = T & { id: string; createdAt: string; updatedAt: string };

export type AuthUser = components['schemas']['AuthUserDto'];
export type AuthSession = components['schemas']['AuthResponseDto'];
export type ApiErrorBody = components['schemas']['ApiErrorDto'];
export type Workspace = Doc<components['schemas']['Workspace']>;
export type AcceptedInvite = components['schemas']['AcceptedInviteDto'];
export type CreateWorkspaceInput = components['schemas']['CreateWorkspaceDto'];
export type LoginInput = components['schemas']['LoginDto'];
export type RegisterInput = components['schemas']['RegisterDto'];
export type AcceptInviteInput = components['schemas']['AcceptInviteDto'];
export type WorkspaceTree = components['schemas']['WorkspaceTreeDto'];
export type TreeSpace = components['schemas']['TreeSpaceDto'];
export type TreeFolder = components['schemas']['TreeFolderDto'];
export type TreeList = components['schemas']['TreeListDto'];
export type InboxCounts = components['schemas']['InboxCountsDto'];
