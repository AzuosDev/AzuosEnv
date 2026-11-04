import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Documents a `{ items, nextCursor }` page of the given type, the shape every
 * paginated listing of the API answers with.
 */
export function ApiPagedResponse<T extends Type<unknown>>(
  model: T,
  description: string,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['items', 'nextCursor'],
        properties: {
          items: { type: 'array', items: { $ref: getSchemaPath(model) } },
          nextCursor: {
            type: 'string',
            nullable: true,
            description: 'Cursor da próxima página; null na última.',
          },
        },
      },
    }),
  );
}
