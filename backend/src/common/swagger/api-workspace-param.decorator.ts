import { applyDecorators } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

/** Declares the `:wsId` of the workspace routes so the contract types the path. */
export function ApiWorkspaceParam(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiParam({
      name: 'wsId',
      description: 'Workspace do recurso.',
      schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    }),
  );
}
