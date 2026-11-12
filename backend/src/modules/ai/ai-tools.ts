import { MAX_TOOL_ITEMS } from './ai-fields';
import { AiToolDefinition } from './ai-provider';

/**
 * Tools the model may ask for. Every one of them runs on the server with the
 * permissions of the user, so the answer never shows what they cannot open.
 */
export const AI_TOOLS: AiToolDefinition[] = [
  {
    name: 'search_tasks',
    description:
      'Busca tarefas do workspace por nome ou id visível (ex.: AZD-142). Use para encontrar uma tarefa citada pelo usuário.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Texto do nome ou prefixo do id visível.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_TOOL_ITEMS },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Detalhes de uma tarefa pelo id ou pelo id visível, com status e prazo.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['idOrCustomId'],
      properties: {
        idOrCustomId: { type: 'string' },
      },
    },
  },
  {
    name: 'list_overdue',
    description: 'Tarefas abertas com prazo vencido, do workspace inteiro ou de uma List.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        listId: { type: 'string', description: 'Opcional: restringe a uma List.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_TOOL_ITEMS },
      },
    },
  },
  {
    name: 'summarize_list',
    description: 'Números de uma List: tarefas por grupo de status, atrasadas e abertas.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['listId'],
      properties: {
        listId: { type: 'string' },
      },
    },
  },
  {
    name: 'my_tasks',
    description: 'Tarefas do próprio usuário por seção (atrasadas, hoje, próximos 7 dias, depois).',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
];
